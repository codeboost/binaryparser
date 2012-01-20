/*
	BinaryParser simple example. 
	(c) 2010 Florin Braghis (florin.braghis@gmail.com). 
	MIT License.
	
	The sample shows how to parse a binary stream with the following format:
	stream = {
		stringSize: 4 bytes
		stringData: stringSize bytes
	}
	
	The program will print out the size of the string and the string from the binary buffer.
*/
var sys = require('util');
var bp = require('../');
var BinaryBuilder = require('./binary.builder').BinaryBuilder;


var parser = new bp.BinaryParser;

parser.setFormat({
	
	size: bp.dword(),
	data: bp.bits('size', function(data){
	
		sys.puts(this.size + ' bytes received: ' + data);
	})
});



//Feed data to the parser
var buffer = new Buffer(20);

//First 4 bytes is the size (little endian order) followed by "12345"
buffer.write('\x05\x00\x00\x0012345'); 

//Add the buffer to the parser and let it do it's job
parser.addBuffer(buffer);
