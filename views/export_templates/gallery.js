/**
 * Created by chris on 2/21/16.
 */

$(document).ready(function () {
  $('.animate-button').click(function (event) {
    var seshid = $(this).parents('.session').data('seshid');
    Gallery.toggleGIFs($(this).parents('.session'));
    return true;
  });
});

var Gallery = {};

Gallery.toggleGIFs = function toggleGIFsF(sessionRow, forceOff) {
  var gifson = $(sessionRow).hasClass('selected');

  $(sessionRow).find('img').each(function () {
    if (gifson || forceOff) {
      $(this).attr('src', $(this).attr('src').replace('.gif', '.jpg'));
    } else {
      $(this).attr('src', $(this).attr('src').replace('.jpg', '.gif'));
    }
  });

  gifson = !(gifson || forceOff);
  $(sessionRow).data('gifson', gifson ? 'true' : 'false');

  if (!forceOff) {
    $('.session.selected').each(function () {
      if (this != sessionRow)
        Gallery.toggleGIFs(this, forceOff);
    });
  }

  if (gifson) {
    $(sessionRow).addClass('selected');
    $(sessionRow).find('.animate-button span').removeClass('glyphicon-play').addClass('glyphicon-stop');
  } else {
    $(sessionRow).removeClass('selected');
    $(sessionRow).find('.animate-button span').removeClass('glyphicon-stop').addClass('glyphicon-play');
  }

};