var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/live', function(req, res, next) {
  res.render('live', { title: 'Live Photobooth Images' });
});

router.get('/gallery-test', function(req, res, next) {
  res.render('export_templates/index', { title: 'Express' });
}).

module.exports = router;
