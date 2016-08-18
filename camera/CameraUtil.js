/**
 * Created by chris on 3/5/15.
 */

var gphoto2 = require('gphoto2'),
    fs = require('fs'),
    util = require('util'),
    events = require('events'),
    sprintf = require('sprintf-js').sprintf;
    gm = require('gm');

/**
 * Constructs a new camera utility class to talk to gphoto2 for us.
 *
 * @constructor
 */
function CameraUtil() {
  events.EventEmitter.call(this);
  this._GPhoto = new gphoto2.GPhoto2();

  this.capturing = false;
  this.ready = false;
  this.runningLV = false;
  this.lvBuff = null;
  this.lvStreamListeners = [];
  this.recordingLV = true;

  this._setUpCamera();
}

util.inherits(CameraUtil, events.EventEmitter);

/**
 * Private function that looks for a camera and gets ready to use it.
 *
 * @private
 */
CameraUtil.prototype._setUpCamera = function () {
  this._GPhoto.list(function (list) {
    if (list.length === 0) {
      this.error = "No camera found.";
      //this.emit('error', new Error("No camera found."));
      return;
    }

    this._camera = list[0];
    this.ready = true;
    this.emit('ready');
  }.bind(this));
};

/**
 * Helper function for handle the camera not being ready. Will respond to call callback for you if the camera isn't
 * ready or there is an error.
 *
 * @param {Function} cb
 * @returns {boolean} If the camera is ready or not.
 * @private
 */
CameraUtil.prototype._handleNotReady = function (cb) {
  if (this.ready === false) {
    if (this.error) {
      cb(new Error(this.error));
    } else {
      cb(new Error('Camera not ready'));
    }
    return false;
  } else {
    return true;
  }
};

/**
 * Dumps the camera config object.
 *
 * @param {Function} cb - Callback to call when the data is retrieved, or there is an error.
 */
CameraUtil.prototype.dumpConfig = function (cb) {
  if(this._handleNotReady(cb) === false) return;

  this._camera.getConfig(function(err, config) {
    if (err) {
      cb(new Error(err));
      return;
    }

    cb(null, config);
  });
};

/**
 * Instructs the camera to take a picture. Calls back when it is done or there was an error
 *
 * @param {String} path - Folder the image should go without trailing slash.
 * @param {String} [name] - Name of the image no extension. If null it will create a name.
 * @param {Function} cb - Callback for completion or error. Calls with err|null, imageName, thumbnailName
 */
CameraUtil.prototype.takePicture = function (path, name, cb) {
  if (this.error) {
    cb(new Error(this.error));
    return;
  }

  if (this.capturing === true) {
    cb(new Error('currently capturing, come back later'));
    return;
  }

  this.recordingLV = false;

  this.capturing = true;

  var imgName;
  if (name !== null) {
    imgName = name;
  } else {
    imgName = "cap-" + new Date().getTime();
  }

  var imgPath = path + '/' + imgName + '.jpg';
  var thumbPath = path + '/' + imgName + '.thumb.jpg';

  console.log('Capturing to: ' + imgPath);

  this._camera.takePicture({download: true}, function (er, data) {
    if (er) {
      if (er === -53) {
        cb(new Error("Could not claim USB device."))
      } else {
        cb(new Error(er));
      }
      return;
    }

    fs.writeFileSync(imgPath, data);

    // make thumbnail
    gm(imgPath)
        .options({imageMagick: true})
        .resize(640, 480)
        .noProfile()
        .write(thumbPath, function (err) {
          if (err) {
            console.error(err);
            cb(new Error('failed to make thumbnail: ' + err));
          } else {
            cb(null, imgName + '.jpg', imgName + '.thumb.jpg');
          }
        });


    this.capturing = false;
  }.bind(this));
};

/**
 * Starts liveview. This may take around 20 seconds to start. Calls back when its started and got first frame.
 *
 * @param {String} lvPath - Folder to put the liveview data in.
 * @param {Function} cb - Callback to call when live view has started or an error occured
 */
CameraUtil.prototype.startLV = function (lvPath, cb) {
  if (!this._handleNotReady(cb)) return;

  // if it's already running return immediately.
  if (this.runningLV === true) {
    cb(null);
    return;
  }

  this.runningLV = true;
  this.lvPath = lvPath;
  this.lvTmp = lvPath + '/' + 'lv.XXXXXX';

  if (!fs.existsSync(this.lvPath)) {
    cb(new Error('Live view path not valid'));
  }

  // capture our first frame callback when it finishes
  this._captureLVFrame(function (err) {
    if (err) {
      cb(err);
    } else {
      cb();
      this.emit('lvstart');
    }
  });
};

/**
 * Get the current status of liveview.
 *
 * @returns {{running: (boolean|*)}}
 */
CameraUtil.prototype.getLVStatus = function () {
  var ret = {running: this.runningLV, recording: this.recordingLV};
  return ret;
};

/**
 * Private function for capturing liveview frame from gphoto2.
 *
 * @param {Function} [cb] - Optional callback for when the first frame comes through or it errors out.
 * @private
 */
CameraUtil.prototype._captureLVFrame = function (cb) {
  //console.log('in _captureLVFrame: ' + this.runningLV);
  if (this.runningLV === true) {
    this._camera.takePicture({targetPath: this.lvTmp, preview: true}, function (er, tmpname) {
      if (er) {
        console.log(er);
        if (er === -53) {
          if (cb) cb(new Error("Could not claim USB device. Perhaps you need to sudo killall PTPCamera."))
        } else {
          if (cb) cb(new Error(er));

        }
        return;
      }

      // read in the frame to a buffer
      this.lvBuff = fs.readFileSync(tmpname);

      // delete the frame or 'record' it
      if (this.recordingLV === true && this.lvRecName) {
        fs.renameSync(tmpname, sprintf('%s/%s%03i.jpg', this.lvPath, this.lvRecName, this.lvRecFrameCount++));
      } else {
        fs.unlinkSync(tmpname);
      }

      // write to the M-JPEG streams
      this._writeLVToStreams(this.lvBuff);

      // set a time out to get our next frame.
      setTimeout(this._captureLVFrame.bind(this), 150);

      if (cb) cb(null);
    }.bind(this));


  } else { // Looks like liveview stop was requested. SHUT IT DOWN!
    // TODO: this is nikon specific turing off live view. need it for Canon!
    this._camera.setConfigValue('viewfinder', 0, function(err) {
      if(err) {
        console.error(err);
      } else {
        console.log('turned off live view');
        this.emit('lvstop');
      }
    });
  }
};

/**
 * Private function to write a new jpeg to all requests listening on the M-JPEG stream.
 *
 * @param {Buffer} buff - Buffer of the new jpeg frame.
 * @private
 */
CameraUtil.prototype._writeLVToStreams = function (buff) {
  //console.log('new frame to write to streamers');
  this.lvStreamListeners.forEach(function (streamer) {
    //console.log('writing to streamer ' + buff.length);
    streamer.write("--myboundary\r\n")
    streamer.write("Content-Type: image/jpeg\r\n");
    streamer.write("Content-Length: " + buff.length + "\r\n");
    streamer.write("\r\n");
    streamer.write(buff);
    streamer.write("\r\n");
  });
};

/**
 * Get the most recent liveview frame.
 *
 * @returns {null|Buffer} Buffer of frame or null if liveview isn't active.
 */
CameraUtil.prototype.getLVLatest = function() {
  if (this.runningLV === true) {
    return this.lvBuff;
  } else {
    return null;
  }
};

/**
 * Handles a request wanting the M-JPEG live view stream. This adds the request to the lvStreamListeners and binds
 * on the event if they close the stream.
 *
 * @param {express.Response} res - The express response that wants M-JPEG.
 */
CameraUtil.prototype.handleLVStream = function(res) {
  console.log('new streamer!');
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=myboundary',
    'Cache-Control': 'no-cache',
    'Connection': 'close',
    'Pragma': 'no-cache'
  });

  this.lvStreamListeners.push(res);

  res.on('close', function() {
    console.log('streamer closed');
    var index = this.lvStreamListeners.indexOf(res);
    if (index > -1) {
      this.lvStreamListeners.splice(index, 1);
      console.log('streamer removed');
    }
  }.bind(this));
};

CameraUtil.prototype.startLVRecord = function (namePrefix) {
  if (this.runningLV === true) {
    this.lvRecName = namePrefix;
    this.lvRecFrameCount = 0;
    this.recordingLV = true;
  }
};

/**
 * Stop running the livestream. This sets the runningLV flag to false. On the next loop around it will notice it and
 * shut down the liveview.
 */
CameraUtil.prototype.stopLV = function () {
  this.runningLV = false;
  this.recordingLV = false;

  this.lvStreamListeners.forEach(function(streamer) {
    streamer.end();
  });
};



module.exports = CameraUtil;


