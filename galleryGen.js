/**
 * Created by chris on 7/19/15.
 */


var fs = require('fs'),
    jade = require('jade');

var EXPORT_PATH = './gallery_export';
var SESSIONS_PATH = './public/images/sessions'

var deleteFolderRecursive = function(path) {
  if( fs.existsSync(path) ) {
    fs.readdirSync(path).forEach(function(file,index) {
      var curPath = path + "/" + file;
      if(fs.statSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};


// wipe it if it exists
if(fs.existsSync(EXPORT_PATH)) {
  deleteFolderRecursive(EXPORT_PATH);
}

// make export directory
fs.mkdirSync(EXPORT_PATH);

// make export
var sessionRenderer = jade.compileFile('./views/export_templates/session_page.jade', { pretty: '  ' });
var galleryRenderer = jade.compileFile('./views/export_templates/gallery_page.jade', { pretty: '  ' });


var sessions = [];

fs.readdir(SESSIONS_PATH, function(err, files) {
  if(err) {
    console.error("AWW SNAP!!")
    throw err;
  }

  var TESTCOUNT = 0;

  for (var i in files) {


    if(files[i] !== ".DS_Store" && files[i] !== "README.md") {
      if(++TESTCOUNT > 5) {
        break;
      }
      processSession(files[i]);
    }

    var galleryPage = galleryRenderer({sessions: sessions});
    fs.writeFileSync(EXPORT_PATH + '/index.html', galleryPage);
    fileCopy('./views/export_templates/gallery_style.css', EXPORT_PATH + '/theme.css');
    fileCopy('./views/export_templates/bootstrap-theme.css', EXPORT_PATH + '/bootstrap-theme.css');
    fileCopy('./views/export_templates/gallery.js', EXPORT_PATH + '/gallery.js');
  }
});


function processSession(seshid) {
  var seshMetaData = JSON.parse(fs.readFileSync(SESSIONS_PATH + '/' + seshid + '/session.json'));
  // knock out off numbered (errored) sessions
  if(seshMetaData.imageCount === 5) {
    seshMetaData.view = {};
    var seshDate = new Date(Date.parse(seshMetaData.startTime));
    seshMetaData.view.time = seshDate.getHours() + ':' + seshDate.getMinutes();

    sessions.push(seshMetaData);
    generatePage(seshid, seshMetaData);
  }
}

function generatePage(seshid, seshMetaData) {
  var seshExpPath = EXPORT_PATH + '/' + seshid;

  fs.mkdirSync(seshExpPath);

  for(var i = 0; i < 5; i++) {
    fileCopy(SESSIONS_PATH + '/' + seshid + '/images/img-0' + i + '.thumb.jpg', seshExpPath + '/img-0' + i + '.thumb.jpg');
    fileCopy(SESSIONS_PATH + '/' + seshid + '/images/img-0' + i + '.gif', seshExpPath + '/img-0' + i + '.thumb.gif');
  }

  var session_page = sessionRenderer(seshMetaData);
  fs.writeFileSync(seshExpPath + '/index.html', session_page);

}

function fileCopy(from, to) {
  fs.createReadStream(from).pipe(fs.createWriteStream(to));
}
