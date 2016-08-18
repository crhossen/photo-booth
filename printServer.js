/*
 * Junk code for testing printing using macOS printing.
 */

var sys = require('sys');
var exec = require('child_process').exec;
var fs = require('fs');
var wkhtmltopdf = require('wkhtmltopdf');

var shouldActuallyPrint = true;

var htmlString = "<h1>Hi Chris!</h1>";
var printSize =  { pageWidth: '6in', pageHeight: '4in' };

wkhtmltopdf(htmlString, printSize, function (code, signal) {

	if (shouldActuallyPrint) {
		exec('lp -o media="4x6 Portrait /tmp/pbprint.pdf');
		console.log("Job sent to printer! 2");
	}
	else {
		console.log("Printing skipped");
	}
})
  .pipe(fs.createWriteStream('/tmp/pbprint.pdf'));
