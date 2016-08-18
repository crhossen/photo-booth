/**
 * Created by chris on 3/5/15.
 */

var isLive = false;
var seshid = null;
var countingDown = false;
var initialWait = 4000;
var betweenShoots = 3000;
var imageCount;
var previewing = false;
var previewingGIFS = false;
var previewURLS = {};
var printCopies = 1;

$(document).ready(function() {

  $('#print-button').click(function () {
    hitPrint();
  });

  $('#copies-plus').click(function () {
    if (printCopies < 10) {
      printCopies++;
      $('#print-copies-input').val(printCopies);
    }
  });

  $('#copies-minus').click(function () {
    if (printCopies > 1) {
      printCopies--;
      $('#print-copies-input').val(printCopies);
    }
  });

  $('#try-again').click(function () {
    location.reload();
  });

  $('#done-button').click(function () {
    $('#new-session-card').show();
    $('#end-session-card').hide();
  });


  $('#in-session-card').hide();
  $('#processing-session-card').hide();
  $('#end-session-card').hide();
  $('#error-card').hide();

  $('#gif-toggle').click(toggleGIFPreview);

  $('.start-session').click(function () {
    previewing = false;
    $.ajax({
      url: '/sessions/new',
      type: 'POST'
    }).done(function (data, textStatus, jqXHR) {
      seshid = data.id;
      $('#new-session-card').hide();
      $('#end-session-card').hide();
      $('#in-session-card').show();
      lvStart();
      imageCount = 0;
    }).fail(function (jqXHR, textStatus, errorThrown) {
      $('.new-sesh-error').text(JSON.parse(jqXHR.responseText).error);
      $('#sesh-alert').show();
    });
  });

  $('#kill-session').click(function () {
    $.ajax({
      url: '/sessions/kill',
      type: 'POST'
    }).done(function (data, textStatus, jqXHR) {
      var sid = data.sid;
      $('#kill-session').hide();
      $('#link-to-killed-session').attr('href', '/images/sessions/' + sid).show();
    }).fail(function (jqXHR, textStatus, errorThrown) {
      $('.new-sesh-error').text('No session to kill.');
    });
  });

  $('#take-picture').click(function () {
    $('#spinner').show();

    $.ajax({
      url: '/sessions/' + seshid + '/capture',
      type: 'POST'
    }).done(function (data, textStatus, jqXHR) {
      if(data.status === 'done') {
        $('<a href="' + data.url + '"><img src="' + data.thumbUrl + '"/></a>').appendTo('#display-picture');
      }
    }).fail(function (jqXHR, textStatus, errorThrown) {
      wompWomp(JSON.parse(jqXHR.responseText).error);
    });
  });

  $('#start-rec-countdown').click(function () {

  });



  $('#end-sesh-btn').click(function () {

  });
});

function lvStart() {
  if (isLive === false) {
    $.ajax({
      url: '/sessions/' + seshid + '/startlv',
      type: 'POST'
    }).done(function (data, textStatus, jqXHR) {
      $('#live-view-img').remove();
      $('#live-view').append($('<img id="live-view-img" src="' + '/camera/liveview/stream?t=' + new Date().getTime() + '"/>'));
      isLive = true;
      $('#count-down-text').text('Get Ready!');
      setTimeout(countDownAndShoot, initialWait);
    }).fail(function (jqXHR, textStatus, errorThrown) {
      wompWomp(JSON.parse(jqXHR.responseText).error);
    });

    //$('#live-view').text('Staring live view. please wait');
    //isLive = true;
  } else {
    $.ajax({
      url: '/sessions/' + seshid + '/stoplv',
      type: 'POST'
    }).done(function () {
      isLive = false;
      $('#live-view').empty();
    });
  }
}

function countDownAndShoot() {
  if (countingDown === true) return;
  countingDown = true;
  $.ajax({
    url: '/sessions/' + seshid + '/recordlv',
    type: 'POST'
  }).done(function (data) {
    var recCountdown = $('#count-down-text').show().text('3');
    setTimeout(function () {
      recCountdown.text('2');
      setTimeout(function () {
        recCountdown.text('1');
        setTimeout(function () {
          recCountdown.text('Smile!');
          $('#live-view-img').attr('src', '/images/logoOnBlack.png');
          $.ajax({
            url: '/sessions/' + seshid + '/capture',
            type: 'POST'
          }).done(function (data, textStatus, jqXHR) {
            if(data.status === 'done') {
              recCountdown.hide();
              $('#live-view-img').attr('src', data.thumbUrl);
              imageCount++;

                setTimeout(function () {


                  if (imageCount < 5) {
                    $('#live-view-img').attr('src', '/camera/liveview/stream?t=' + new Date().getTime());
                    setTimeout(countDownAndShoot, 500);;
                  } else {
                    endSession();
                  }
                }, betweenShoots);


            }

            countingDown = false;
          }).fail(function (jqXHR, textStatus, errorThrown) {
            wompWomp(JSON.parse(jqXHR.responseText).error);
            countingDown = false;
          });

        }, 1000);
      }, 1000);
    }, 1000);
  }).fail(function (jqXHR, textStatus, errorThrown) {
    countingDown = false;
    wompWomp(textStatus);
  });
}

function endSession() {
  $('#in-session-card').hide();
  $('#processing-session-card').show();
  $.ajax({
    url: '/sessions/' + seshid + '/end',
    type: 'POST'
  }).done(function () {
    isLive = false;
    $('#live-view').empty();
    $('<img id="live-view-img" src="/images/logoOnBlack.png"/>').appendTo('#live-view');
    $('<div id="count-down-overlay"><span id="count-down-text">Warming up!</span></div>').appendTo('#live-view');
    $('#display-picture').empty();


    processSession();
  });
}

function processSession() {
  $.ajax({
    url: '/sessions/' + seshid + '/prepareprint',
    type: 'POST'
  }).done(function (data) {
    previewURLS = data;

    $('#preview-frame').attr('src', data.printURL);
    $('#link-to-session').attr('href', '/images/sessions/' + seshid);
    $('#link-to-print').attr('href', '/sessions/' + seshid + '/print');
    $('#processing-session-card').hide();
    $('#end-session-card').show();
    previewingGIFS = false;
    previewing = true;
    printCopies = 1;
    $('#print-copies-input').val(1);
    $('#print-button').removeClass('disabled').text('Print Now!');

  }).fail(function (jqXHR, textStatus, errorThrown) {
    wompWomp(textStatus);
  });
}

function toggleGIFPreview() {
  if (previewing) {
    if (previewingGIFS) {
      previewingGIFS = false;
      $('#preview-frame').attr('src', previewURLS.printURL);
    } else {
      previewingGIFS = true;
      $('#preview-frame').attr('src', previewURLS.gifPrintURL);
    }
  }
}

function wompWomp(error) {

  // end the session if it existed
  if (seshid) {
    $.ajax({
      url: '/sessions/' + seshid + '/end',
      type: 'POST'
    }).done(function () {
      // wutevs lul
    });
  }

  $('#new-session-card').hide();
  $('#in-session-card').hide();
  $('#processing-session-card').hide();
  $('#end-session-card').hide();
  $('#error-card').show();
  $('#other-alert').show();
}

function hitPrint() {
  if (seshid) {
    $.ajax({
      url: '/sessions/' + seshid + '/print',
      type: 'POST',
      data: {copies: printCopies}
    }).done(function (data) {
      $('#print-modal').modal('hide');

    }).fail(function (jqXHR, textStatus, errorThrown) {
      wompWomp(textStatus);
    });
    $('#print-button').addClass('disabled').text('Printing...');
  }
}