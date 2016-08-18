/**
 * Created by chris on 3/6/15.
 */

var util = require('util'),
    uuid = require('uuid'),
    events = require('events'),
    fs = require('fs'),
    jade = require('jade'),
    sprintf = require('sprintf-js').sprintf,
    gm = require('gm'),
    async = require('async'),
    sys = require('sys'),
    exec = require('child_process').exec,
    os = require('os'),
    wkhtmltopdf = require('wkhtmltopdf');

/**
 * Path where the session data will reside.
 *
 * @const
 * @type {string}
 */
var SESSIONS_PATH =  process.cwd() + '/public/images/sessions';

/**
 * Constructs a new photobooth session or loads one stored on disk.
 *
 * @param {Boolean} isNew - If we are creating a new session this should be true.
 * @param {Function} [readyHandler] - Optional ready event handler to bind.
 * @param {Function} [errHandler] - Optional error handler to bind.
 * @param {String} [sessionID] - ID of the session to load.
 * @constructor
 */
function Session(isNew, readyHandler, errHandler, sessionID) {
  events.EventEmitter.call(this);

  // if they supply event handlers bind them
  if(readyHandler) this.on('ready', readyHandler);
  if(errHandler) this.on('err', readyHandler);

  this.ready = false;
  this.camera = null;
  this.imageCount = 0;
  this.images = [];

  // if its new we should be given the sessionID
  if (isNew === true) {
    this.id = uuid.v1();
    this.isActiveSession = true;
    this.startTime = new Date();
    this.status = 'active';
  } else {
    this.id = sessionID;
    this.isActiveSession = false;
    this.status = 'finalized'
  }

  // determine session paths
  this.fsPath = SESSIONS_PATH + '/' + this.id;
  this.imagesPath = this.fsPath + '/images';
  this.lvPath = this.fsPath + '/liveview';

  // determine public paths
  this.pubPath = '/images/sessions/' + this.id;
  this.pubImagesPath = this.pubPath + '/images';

  // prepare or load the session
  if (isNew === true) {
    this._prepareSession();
  } else {
    if(fs.existsSync(this.fsPath)) {
      var sessiondata = JSON.parse(fs.readFileSync(this.fsPath + '/session.json'));
      this.images = sessiondata.images;
      this.startTime = Date.parse(sessiondata.startTime);
      this.imageCount = sessiondata.imageCount;
    } else {
      throw new Error("Session does not exist");
    }
  }
}

util.inherits(Session, events.EventEmitter);

/**
 * Private function for setting up the session. This is called by the constructor.
 *
 * @private
 */
Session.prototype._prepareSession = function () {

  // call fs.mkdir a few times to build the session space
  async.series([
    function (cb) { fs.mkdir(this.fsPath, null, cb); }.bind(this),
    function (cb) { fs.mkdir(this.imagesPath, null, cb); }.bind(this),
    function (cb) { fs.mkdir(this.lvPath, null, cb); }.bind(this),
  ],
  // determine if session folder succeeded or failed to create
  function (err) {
    if (err) {
      this.emit('error', err);
    } else {
      this.emit('ready', this);
      this.ready = true;
    }
  }.bind(this));
};

/**
 * Start liveview for this session.
 *
 * @param {Function} cb - callback for when liveview is running
 */
Session.prototype.startLV = function (cb) {
  this.camera.startLV(this.lvPath, cb);
}

/**
 * Get the current status of liveview.
 *
 * @returns {{running: (boolean|*)}}
 */
Session.prototype.getLVStatus = function () {
  return this.camera.getLVStatus();
};

/**
 * Stop running livestream.
 */
Session.prototype.stopLV = function () {
  this.camera.stopLV();
};

/**
 * Start recording LV until the next image is taken
 */
Session.prototype.recordLV = function () {
  if (this.camera.getLVStatus().running === true) {

    this.camera.startLVRecord(sprintf('lv-%02i-', this.imageCount));
  }
};

/**
 * Take a picture for this session.
 *
 * @param {Function} cb - Callback to hit when the capture is done.
 */
Session.prototype.takePicture = function (cb) {
  this.camera.takePicture(this.imagesPath, sprintf('img-%02i', this.imageCount), function(err, imgName, thumbName) {
    if (err) {
      cb(err);
      return;
    }

    this.imageCount++;
    cb(null, {
      status: 'done',
      url: this.pubImagesPath + '/' + imgName,
      thumbUrl: this.pubImagesPath + '/' + thumbName
    });

    this.emit('image', this.pubImagesPath + '/' + imgName);

    async.nextTick(function() {
      this._buildGIF(this.imageCount-1, thumbName);
    }.bind(this));

  }.bind(this));
};

/**
 * Build GIF for an image
 *
 * @param imageNumber
 * @param thumbName
 * @private
 */
Session.prototype._buildGIF = function(imageNumber, thumbName) {
  fs.exists(sprintf('%s/lv-%02i-000.jpg', this.lvPath, imageNumber), function (exists) {
    if (!exists) {
      console.log(sprintf('no liveview data found for image %02i', imageNumber));
      return;
    }

    // copy the tumbnail to the liveview directory so it can be the last frame
    //var finalThumbSrc = fs.createReadStream(this.imagesPath + '/' + thumbName)
    //var finalThumbDst = fs.createWriteStream(sprintf('%s/lv-%02i-999.jpg', this.lvPath, imageNumber));
    //finalThumbSrc.pipe(finalThumbDst);

    // once the copy is done we can make the gif
    //finalThumbDst.on('finish', function () {
      gm()
          .options({imageMagick: true})
          .command('convert', '-delay 20 -loop 0 -coalesce -layers optimize-plus')
          .resize(320, 240)
          .in(sprintf('%s/lv-%02i-*.jpg', this.lvPath, imageNumber))
          .write(sprintf('%s/img-%02i.gif', this.imagesPath, imageNumber), function(err) {
            if(err) console.error(sprintf('gif for image %02i failed to create', imageNumber));
            else console.log(sprintf('gif for image %02i created', imageNumber));
          });
    }.bind(this));

  //}.bind(this));
};

/**
 * End the session.
 *
 * @param {Function} cb - Callback for when session has finished.
 */
Session.prototype.endSession = function (cb) {
  this.stopLV();
  this.isActiveSession = false;
  this.emit('done');
  this.endTime = new Date();
  this.status = 'done';


  // array to pass to export view
  var imgNames = [];

  for (var i = 0; i < this.imageCount; i++) {
    var image = {
      name: sprintf('img-%02i', i),
      full: sprintf('img-%02i.jpg', i),
      thumb: sprintf('img-%02i.thumb.jpg', i),
      keeper: true
    };

    var imgName = {full: sprintf('img-%02i.jpg', i)}

    // if
    if (fs.existsSync(sprintf('%s/img-%02i.gif', this.imagesPath, i))) {
      imgName.thumb = image.gif = sprintf('img-%02i.gif', i);

    } else {
      imgName.thumb = sprintf('img-%02i.thumb.jpg', i);
    }
    imgNames.push(imgName);
    this.images.push(image)
  }

  var htmlExport = jade.renderFile('./views/sessionExport.jade', {
    sid: this.id,
    imageNames: imgNames
  });

  fs.writeFileSync(this.fsPath + '/index.html', htmlExport);

  // build gif using image tumbnails
  gm()
    .options({imageMagick: true})
    .command('convert', '-delay 250 -loop 0 -coalesce -layers optimize-plus')
    .in(sprintf('%s/img-*.thumb.jpg', this.imagesPath))
    .write(sprintf('%s/images.gif', this.imagesPath), function(err) {
      if(err) console.error(sprintf('gif failed for %s', this.id));
      else console.log(sprintf('gif built for %s', this.id));
      }.bind(this));

  this._saveSessionMetadata(cb);

  // TODO: build fancy session page and print.
};

Session.prototype._saveSessionMetadata = function (cb) {
  fs.writeFile(this.fsPath + '/session.json', JSON.stringify(this.getInfo(), null, ' '), null, cb);
};

/**
 *
 * @returns {{id: (String), images: (*), startTime: (Date), endTime: (Date|null), status: (string), imageCount: (Number), publicPath: (string), active: (boolean)}}
 */
Session.prototype.getInfo = function () {
  var info = {
    id: this.id,
    images: this.images,
    startTime: this.startTime,
    status: this.status,
    imageCount: this.imageCount,
    publicPath: this.pubPath,
    active: this.isActiveSession
  };

  // session might not have an end time yet
  if (this.endTime) {
    info.endTime = this.endTime
  }

  return info;
};

Session.prototype.prepareForPrint = function (cb) {
  var images = this.images;
  var error = null;

  if (images == null || images.length == 0) {
    images = new Array();
    //error = new Error("No images found!");
  }

  var htmlExport = jade.renderFile('./views/print_templates/five_up.jade', {
    images: images
  });

  fs.writeFileSync(this.fsPath + '/print.html', htmlExport);

  var gifModeImages = [];
  this.images.forEach(function(image) {
    if(image.hasOwnProperty('gif')) {
      gifModeImages.push({full: image.gif});
    } else {
      gifModeImages.push({full: image.full});
    }
  });

  var htmlGIFExport = jade.renderFile('./views/print_templates/five_up.jade', {
    images: gifModeImages
  });

  fs.writeFileSync(this.fsPath + '/gifprint.html', htmlGIFExport);

  cb(null, {
    printURL: this.pubPath + '/print.html',
    gifPrintURL: this.pubPath + '/gifprint.html',
  });
};

/**
 * Print the session!
 *
 * @param {number} copies Number of copies to print
 * @param {function} cb Callback for when shits done.
 */
Session.prototype.print = function (copies, cb) {

  console.log('attempting to print ' + copies + ' copies.');

  if (copies == null || copies == 0) {
    copies = 1;
  }

  var printSize =  { pageWidth: '6in', pageHeight: '4in', "margin-bottom": '0mm', "margin-left": '0mm', "margin-right": '0mm', "margin-top": '0mm', output: this.fsPath + '/print.pdf'};

  wkhtmltopdf('file://' + this.fsPath + '/print.html', printSize, function (code, signal) {
    exec('lp -o media="4x6 Portrait" -n ' + copies + ' -o landscape ' + this.fsPath + '/print.pdf');
    console.log("Job sent to printer!");
    cb(null, {status: 'Job sent to printer'});


  }.bind(this)); // .bind calls the function but with whatever we want for the "this" scope


};

/**
 * Loads a session on the disk
 *
 * @param {String} sessionID
 * @param {Function} [readyHandler] - Optional ready event handler to bind.
 * @param {Function} [errHandler] - Optional error handler to bind.
 */
function loadSession(sessionID, readyHandler, errHandler) {
  return new Session(false, readyHandler, errHandler, sessionID);
}

/**
 * Creates a new session.
 *
 * @param {Function} [readyHandler] - Optional ready event handler to bind.
 * @param {Function} [errHandler] - Optional error handler to bind.
 */
function createSession(readyHandler, errHandler) {
  return new Session(true, readyHandler, errHandler);
}



module.exports = {
  loadSession: loadSession,
  createSession: createSession,
  SESSIONS_PATH: SESSIONS_PATH
};
