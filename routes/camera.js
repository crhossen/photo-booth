/**
 * Created by chris on 3/5/15.
 */

var express = require('express');
var router = express.Router();
var cwd = process.cwd();
var CameraUtil = require('../camera/CameraUtil');
var camera = new CameraUtil();
var capturePath = './public/images/captures';

var colorbars = cwd + '/public/images/colorbars.jpg';
var livePath = cwd + '/public/images/liveview';

/**
 * This router should run at /camera
 */

/**
 * Dumps the config of the camera.
 */
router.get('/config', function (req, res, next) {
  camera.dumpConfig(function (err, config) {
    if(err) {
      res.status(500);
      res.json({error: err.message});
      return;
    }
    res.json(config);
  })
});

/**
 * Take a picture
 */
router.get('/capture', function(req, res, next) {
  camera.takePicture(capturePath, null, function(err, imgName, thumbName) {
    if(err) {
      res.json({status: 'error', error: err.message});
      return;
    }

    res.json({status: 'done', url: '/images/captures/' + imgName, thumbUrl: '/images/captures/' + thumbName});
  });
});

/**
 * Gets the status of liveview. returns { running: true|fale }
 */
router.get('/liveview', function (req, res, next) {
  res.json(camera.getLVStatus());
});

/**
 * Starts liveview if it can. Responds once liveview is running.
 */
router.post('/liveview/start', function (req, res, next) {
  camera.startLV(livePath, function (err) {
    if(err) {
      res.status(500);
      res.json({error: err.message});
      return;
    }

    res.json({running: true});
  });
});

/**
 * Stops live view. Returns nothing.
 */
router.post('/liveview/stop', function (req, res, next){
  camera.stopLV();
  res.end();
});

/**
 * The M-JPEG stream of liveview. Returns a jpeg of SMPTE colorbars if its not running.
 */
router.get('/liveview/stream*', function (req, res, next) {
  if (camera.getLVStatus().running === true) {
    camera.handleLVStream(res);
  } else {
    res.append('Content-Type', 'image/jpeg');
    res.sendFile(colorbars);
  }
});

/**
 * Gets the latest frame from the liveview.
 */
router.get('/liveview/latest*', function(req, res, next) {
  res.append('Content-Type', 'image/jpeg');
  if (camera.getLVStatus().running === true) {
    res.send(camera.getLVLatest());
  } else {
    res.sendFile(colorbars);
  }
});

module.exports = {
  router: router,
  camera: camera
};
