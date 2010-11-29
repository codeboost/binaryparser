/*
	PNG file parser. 
	(c) 2010 Florin Braghis (florin.braghis@gmail.com). 
	MIT License.
	
	The sample shows how to parse a PNG  file.
	See http://en.wikipedia.org/wiki/Portable_Network_Graphics for the format description.
	
	The PNG file has the following structure:
	
	png = {
		signature: 8 bytes,
		chunks: {
			length: 4 bytes,
			type: 4 bytes,
			data: length bytes
			CRC: 4 bytes
		}
		
	}
	
	The program will print out the contents of the chunks of the PNG file.
*/

var sys = require('sys');
var bp = require('../binaryparser');
var fs = require('fs');

sys.puts("PNG Parser: Nodejs binary stream parser demo");


bp.setDebug(false);

if (process.argv.length < 3){
	sys.puts('Usage: node png.parser.js [fileName]');
	return ; 
}

fileName = process.argv[2];

	
sys.puts("Parsing File: " + fileName);
sys.puts("-----------------------------------");


var parser = new bp.BinaryParser;

parser.setByteOrder('be');

parser.setFormat({
	formatName: 'Main',
	sigLow: bp.dword(),
	sigHigh: bp.dword(function(){
		
		if (this.sigLow == 0x89504E47 && this.sigHigh == 0x0D0A1A0A){
			sys.puts('Valid PNG descriptor found');
		}
		else {
		
			sys.puts('File is not a valid PNG.');
			parser.exit();
		}
		
	}),
	chunks: {
		formatName: 'chunks',
		__repeat: 'forever',
		chunkLength: bp.dword(),
		chunkType: bp.bits(4),
		chunkData: bp.bits('chunkLength'),
		chunkCRC: bp.dword(),
		onFinished: function(){
			sys.puts("Chunk of type '" + this.chunkType.toString() + "' found. Data length: " + this.chunkLength + "; CRC: 0x" + this.chunkCRC.toString(16));
			
			
			if (this.chunkType.toString() == 'IHDR'){
				sys.puts('Found Header chunk. Parsing.');
				var header = {
					width: bp.dword(),
					height: bp.dword(),
					bpp: bp.char8(),
					colorType: bp.char8(),
					compr: bp.char8(),
					filter: bp.char8(),
					interlace: bp.char8(),
					onFinished: function(){
						
						sys.puts('width=' + this.width + '; height=' + this.height);
					}
				};
				
				//Parse the header chunk 
				(new bp.BinaryParser()).setByteOrder('be').addBuffer(this.chunkData)
				.setFormat(header);
				
				//Header should now contain all the field values, print them
				sys.puts('IHDR=' + sys.inspect(header.__values));
			}
			
			
		}
	},
	
	onFinished: function(){
		
		sys.puts('Finished.');
	}
});

fs.readFile(fileName, function(err, data){
	
	if (err){
		sys.puts('Error opening file');
	}
	else
		parser.addBuffer(data);
});
