/*
Binary Parser. (c) 2010 Florin Braghis <florin.braghis@gmail.com>, 
License: MIT
Created in Barcelona, Spain.
*/

var BinaryParser = (function(){

if (typeof window != "undefined"){
	exports = {};
} else {
	//nodejs 
	var sys = require('util'),
	BufferList = require('./lib/bufferlist').BufferList;
	require('./lib/oo');
}



var debug = function(){}

exports.setDebug = function (isDebug){
	if (isDebug){
		debug = function(msg){sys.debug(msg);} 
	} else debug = function(){}
}

//Data types
var DataType = Class.extend({
	size: 0,
	callback: function(){},

	init: function(callback){
	
		if (callback)
			this.callback = callback;
	}
}),

char8 = DataType.extend({
	size: 1
}),

ushort = DataType.extend({
	size: 2
}),

dword = DataType.extend({
	size: 4
}),

bits = DataType.extend({
	sizeName: "",
	size: 0,
	init: function(sizeName, callback){
		if (typeof sizeName == 'function')
			throw new Error("BinaryParser::bits() : first argument must be sizeName or numeric");
			
		this.__super__(callback);
		this.sizeName = sizeName;
	}
});

exports.char8 = function(callback){
	return new char8(callback);
}

exports.ushort = function(callback){
	return new ushort(callback);
}

exports.dword = function(callback){
	return new dword(callback);
}

exports.bits = function(name, callback){
	return new bits(name, callback);
}

// convert byte strings to big endian numbers
var decode = {

	'le': function(bytes){
			var result = 0, len = bytes.length; 
			for (var i = 0; i < len; i++){
				result |= bytes[i] << (i * 8) ;
			}
			return result;
	},
	
	'be': function(bytes){
			var acc = 0;
			for (var i = 0; i < bytes.length; i++) {
				acc += Math.pow(256, bytes.length - i - 1) * bytes[i];
			}
			return acc;
	}
}


var BinaryParser = exports.BinaryParser = Class.extend({

	//Can be instantiated with existing BufferList.
	//If called without parameters, the bufferlist is instantiated. Use addBuffer() to add the buffers.
	init: function(bufferList){
		
		var parser = this;
		
		this.bufferList = bufferList; 
		
		if (this.bufferList === undefined)
			this.bufferList = new BufferList;
		
		this.bufferList.addListener('push', function(){
			parser.explore.call(parser);
		});
		
		this.formats = [];	//stack of formats
		this.offset = 0; 	//global offset in bufferList
		this.byteOrder = 'le';
		this.onFinished = function(){
			debug('Finished parsing');
		}
	},
	
	onFinished : function(evt){
		this.onFinished = evt;
	},
	
	//"le" or "be" meaning Little or Big endian
	setByteOrder: function(enc){
		this.byteOrder = enc; 
		return this;
	},
	
	reset: function(){
		this.formats = [];
		this.offset = 0; 
		this.field = null;
		this.streamEnd = false;
		return this;
	},
	
	exit: function(){
		this.formats = [];
		this.format.__fields = [];
		return this;
	},
	
	//Tells parser that no more bytes will arive. 
	//The parser will parse all remaining data and then terminate
	endStream: function(){
		this.streamEnd = true; 
		return this;
	},
	
	addBuffer: function(buf){
		debug('**addBuffer, length = ' + buf.length);
		this.bufferList.push(buf);
		return this;
	},
	
	setFormat: function setFormat(fmt){
		debug('Setting format ' + fmt.formatName + '; current format = ' + (this.format ? this.format.formatName : 'none'));
		
		this.field = null; 

		//Save current format 
		if (this.format && !this.format.__finished && this.format != fmt){
			debug('Saving format ' + this.format.formatName + '; fields = ' + this.format.__fields.length);
			this.formats.unshift(this.format);
		}
			
		this.format = fmt;
		
		fmt.__values = fmt.__values || {}; //holds decoded values
		fmt.__byteOrder = fmt.__byteOrder || this.byteOrder; //LittleEndian encoding by default

		if (!fmt.__parsed){
			fmt.__fields = [];
			var repeat = fmt.__repeat || 1;
			if (repeat === 'forever') repeat = 1; 
			
			for (var k = 0; k < repeat; k++){
				for (field in fmt){
				
					//Determine if current field is a new format (eg. an object which is not DataType)					
					var isFormatField = typeof fmt[field] == 'object' && 
										!(fmt[field] instanceof DataType) && 
										field.indexOf('__') != 0; //valid fields should not start with '__'. This is reserved for internal objects.

					if ((fmt[field] instanceof DataType) || isFormatField){
						fmt[field].name = field;
						fmt.__fields.push(fmt[field]);
					}
				}
			}
			
			debug('Parsed format ' + fmt.formatName + '; length = ' + fmt.__fields.length + '; repeat = ' + repeat);
			fmt.__parsed = (fmt.__repeat != 'forever');
			
		} else {
			debug('Restoring format ' + fmt.formatName + '; length = ' + fmt.__fields.length);
		}
		
		return this.nextField();
	},
	
	explore: function explore(){
	
		if (!this.field){
			debug('No active field');
			return;
		}
		
		if (!this.field.__consumed){
			if (this.bufferList.length - this.offset >= this.field.size){
				
				var data = this.bufferList.join(this.offset, this.offset + this.field.size);
                this.offset += this.field.size;
				this.field.__consumed = true;
				var value ;
				
				if (this.field.sizeName === undefined){
					
					value = decode[this.format.__byteOrder](data);
					
					this.format.__values[this.field.name] = value;
					debug('Numeric field decoded ' + this.field.name + '; size ' + this.field.size + '; value: ' + value);
					this.field.callback.call(this.format.__values, value);
				} else {
					debug('Data field decoded ' + this.field.name + '; size ' + this.field.size + '; value ~bits~');
					this.format.__values[this.field.name] = data;
					this.field.callback.call(this.format.__values, data);
					value = '~bits~';
				}
				
				//debug('Decoded field ' + this.field.name + '; size ' + this.field.size + '; value ' + value);
				this.nextField();
			} //else wait for the next field
			else{
				
				var left = this.field.size - (this.bufferList.length - this.offset);
				debug('**Filed ' + this.field.name + '(' + this.field.size + ') has ' + left + ' bytes left')
				if (this.streamEnd){
					debug('Stream ended, exiting...');
					this.exit();
				}
			}
		} else{
			debug('field ' + this.field.name + ' with size ' + this.field.size + ' already consumed');
		}
	},
	
	nextField: function nextField(){
		
		if (this.field && !this.field.__consumed){
			var left = this.field.size - (this.bufferList.length - this.offset);
			
			debug('Field ' + this.field.name + ' not totally consumed. Bytes left = ' + left);
			this.explore();
			return this;
		}
		
		while (this.format.__fields.length){
			
			this.field = this.format.__fields.shift();
			this.field.__consumed = false; 
			
			if (!(this.field instanceof DataType)){	//Is this a new format ?
				//handle repeat: if it's a number or 'forever', do nothing, if it's a string, lookup the field which it references
				if (typeof this.field.__repeat == 'string' && this.field.__repeat !== 'forever')	
					this.field.__repeat = this.format.__values[this.field.__repeat];
					
				if (this.field.__repeat === 0){
					
					debug('Skipping 0-repeat format field ' + this.field.formatName);
					if (this.field.onFinished)
						this.field.onFinished.call(this.format.__values, 0);
				
					continue; 
				} 
				this.setFormat(this.field);
				return this;
			}
			//if 'sizeName' is present, field size must be computed dynamically 
			//sizeName is the name of the field in current format, which contains the size of the current field
			if (this.field.sizeName){	

				this.field.size = (typeof this.field.sizeName == 'string') ? 
									this.format.__values[this.field.sizeName] : this.field.sizeName;
			}
			
			if (this.field.size > 0){
				debug('Next field is \'' + this.field.name + '\' with size ' + this.field.size);

				this.explore();
				return this; 
			} else {
				//size is 0, just notify the format
				if (this.field.callback)
					this.field.callback.call(this.format.__values, 0);
				
			}
		}
		
		debug('Format ' + this.format.formatName + ' finished');
		
		//Finished the fields for current format
		if (this.format.onFinished)
			this.format.onFinished.call(this.format.__values, this.format.__repeat);
			
		if (this.format.__repeat == 'forever'){
			this.setFormat(this.format);
		}
		else
			this.format.__finished = true; 

		if (this.formats.length)
			this.setFormat(this.formats.shift()); //Make the switch to the previously active format
		
		return this;
			
	}
});

return exports;
})();


















