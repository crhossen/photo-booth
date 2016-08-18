/**
 * Created by chris on 3/6/15.
 */

var util = require('util'),
    events = require('events'),
    fs = require('fs'),
    async = require('async'),
    session = require('./Session');

var activeSession = false;
var theActiveSession = null;

var camera = null;

var sessionCache = {};

/**
 * Sets the camera for sessions to use.
 *
 * @param {CameraUtil} cam - The camera
 */
function setCamera(cam) {
  camera = cam;
}

function killActiveSession(cb) {
  if(theActiveSession !== null) {
    var sid = theActiveSession.id;

    theActiveSession.endSession(function () {
      cb(null, {sid: sid});
    });
  } else {
    cb(new Error('No session to kill'));
  }
}


/**
 * Get a session from the cache.
 *
 * @param {String} uuid - The session id to look for.
 * @returns {Session|null} - The Session or id
 */
function getSessionFromCache(uuid) {
  if (sessionCache.hasOwnProperty(uuid)) {
    return sessionCache[uuid];
  }

  return null;
}

/**
 * Get a session from either the cash or disk.
 *
 * @param {String} sessionID - ID of session to fetch.
 * @param {Function} cb - Callback for error or when session is fetched.
 */
function getSession(sessionID, cb) {
  if (!isUUID(sessionID)) {
    cb(new Error('SID provided is not a UUID'));
    return;
  }

  var sesh = getSessionFromCache(sessionID);
  if (sesh !== null) {
    cb(null, sesh);
  } else {
    sesh = loadSessionFromDisk(sessionID);
    if(sesh !== null) {
      sessionCache[sesh.id] = sesh;
      cb(null, sesh);
    }
  }
}


/**
 * Get a listing of all the session IDs. This simply reads the names of everything in the sessions directory.
 *
 * @param {Function} cb - Callback to call when sessions have been listed.
 */
function listSessionIDs(cb) {
  fs.readdir(session.SESSIONS_PATH, function(err, files) {
    if (err) {
      cb(err);
      return;
    }

    async.filter(files, function(file, cb) { cb(isUUID(file)); }, function(results) {
      cb(null, results);
    });
  });
}

/**
 * Tests if a string is a UUID.
 *
 * @param {String} str
 */
function isUUID(str) {
  return (str.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/) !== null);
}

/**
 * Check if a session exists.
 *
 * @param sessionID The session ID to search for.
 * @returns {Boolean} If it was found or not.
 */
function doesSessionExist(sessionID) {
  // filter out the haters. Don't let users trounce your file system.
  if (!isUUID(sessionID)) return false;

  if (sessionCache.hasOwnProperty(sessionID)) {
    return true;
  } else {
    return fs.existsSync(session.SESSIONS_PATH + '/' + sessionID);
  }
}

/**
 * Loads session from disk.
 *
 * @param sid
 * @param cb
 * @returns {*}
 */
function loadSessionFromDisk(sid, cb) {
  if (doesSessionExist(sid) ) {
    return session.loadSession(sid);
  } else {
    return null;
  }
}

/**
 * Creates a new session unless there already is one.
 */
function createSession(cb) {
  if (activeSession === true) {
    cb(new Error("There is currently an active session."));
    return;
  }

  session.createSession(function(sesh) {
        console.log(sesh.id);
        activeSession = true;
        theActiveSession = sesh;
        sessionCache[sesh.id] = sesh;
        sesh.camera = camera;
        cb(null, sesh);

        // bind on the session end so we know its ok for new sessions to happen
        sesh.once('done', function () {
          activeSession = false;
          theActiveSession = null;
        });
      },
  function(err) {
    cb(err);
  });
}

module.exports = {
  listSessionIDs: listSessionIDs,
  doesSessionExist: doesSessionExist,
  createSession: createSession,
  setCamera: setCamera,
  getSessionFromCache: getSessionFromCache,
  getSession: getSession,
  killActiveSession: killActiveSession
};

