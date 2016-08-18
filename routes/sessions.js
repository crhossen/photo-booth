/**
 * Created by chris on 3/6/15.
 */

var async = require('async');
var express = require('express');
var bodyParser = require('body-parser');
var router = express.Router();
var SessionManager = require('../sessions/SessionManager');

function setCamera(cam) {
  SessionManager.setCamera(cam);
}

function returnJSONorError(res, err, data) {
  if (err) {
    res.status(500);
    res.json({error: err.message});
    return;
  }

  res.json(data);
}

router.use(bodyParser.json());

/**
 * List the sessions.
 */
router.get('/', function (req, res, next) {

  // start drinking
  async.waterfall([
    // get the session ids
    SessionManager.listSessionIDs,

    // turn them into nicer objects
    function(sids, wfcb) {
      async.map(sids, function (sid, cb) {
        cb(null, {id: sid, uri: '/sessions/' + sid});
      }, wfcb);
    }

  ], function (err, sessions) { // catch errors or return
    returnJSONorError(res, err, sessions);
    // finish drinking
  });

});

/**
 * List the sessions in an html page
 */
router.get('/list', function (req, res, next) {

  // start drinking
  async.waterfall([
    // get the session ids
    SessionManager.listSessionIDs,

    // turn them into nicer objects
    function(sids, wfcb) {
      async.map(sids, function (sid, cb) {
        cb(null, {id: sid, uri: '/images/sessions/' + sid});
      }, wfcb);
    }

  ], function (err, sessions) { // catch errors or return
    // finish drinking
    res.render('sessionList', {sessions: sessions});
  });

});

/**
 * This handles the filtering of non-existent sessions for us.
 */
router.use('/:sid', function (req, res, next) {
  if (req.method === 'POST' && req.params.sid) {
    next();
  } else if (SessionManager.doesSessionExist(req.params.sid)) {
    next();
  } else {
    res.status(404);
    res.json({error: 'session doesn\'t exist'});
  }
});


router.get('/:sid', function (req, res, next) {
  SessionManager.getSession(req.params.sid, function (err, session) {
    returnJSONorError(res, err, session.getInfo());
  });
});

router.post('/:sid/end', function (req, res, next) {
  SessionManager.getSession(req.params.sid, function (err, session) {
    session.endSession(function (err) {
      res.end();
    });
  });
});

router.post('/:sid/end', function (req, res, next) {
  SessionManager.getSession(req.params.sid, function (err, session) {
    session.endSession(function (err) {
      res.end();
    });
  });
});

router.post('/:sid/prepareprint', function (req, res, next) {
  SessionManager.getSession(req.params.sid, function (err, session) {
    session.prepareForPrint(function (err, locs) {
      returnJSONorError(res, err, locs);
    });
  });
});

router.post('/:sid/print', function (req, res, next) {
  SessionManager.getSession(req.params.sid, function (err, session) {

    var copies = 1;
    if (req.body.copies) {
      copies = req.body.copies;
      if (copies < 1 || copies > 10) {
        console.log('defaulting to one copy because too small or too big');
        copies = 1;
      }
    } else {
      console.log('defaulting to one copy');
    }

    session.print(copies, function (err, status) {
        returnJSONorError(res, err, status);
    });
  });
});



router.post('/:sid/capture', function (req, res, next) {
  SessionManager.getSession(req.params.sid, function (err, session) {
    session.takePicture(function(err, picInfo) {
      returnJSONorError(res, err, picInfo);
    });
  });
});

router.post('/:sid/startlv', function (req, res, next) {
  SessionManager.getSession(req.params.sid, function (err, session) {
    session.startLV(function(err) {
      returnJSONorError(res, err, {running: true});
    });
  });
});

router.post('/:sid/stoplv', function (req, res, next) {
  SessionManager.getSession(req.params.sid, function (err, session) {
    session.stopLV();
    res.end();
  });
});

router.post('/:sid/recordlv', function (req, res, next) {
  SessionManager.getSession(req.params.sid, function (err, session) {
    session.recordLV();
    res.end();
  });
});

router.post('/kill', function(req, res, next) {
  SessionManager.killActiveSession(function (err, data) {
    returnJSONorError(res, err, data);
  });
});


/**
 * Will return an error if an active session already exists.
 */
router.post('/new', function (req, res, next) {
  SessionManager.createSession(function(err, sesh) {
    if (err) {
      res.status(500);
      res.json({error: err.message});
      return;
    }

    res.json({id: sesh.id, uri: '/sessions/' + sesh.id});
  });
});



module.exports = {
  router: router,
  setCamera: setCamera
};