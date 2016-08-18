# photo-booth
Node.js photo booth web application.

## Dependencies
 - Camera with live view supported by libgphoto2.
 - Fast 4x6 printer configured in macOS. Color laser printer works great for this.
 - Get these from brew
   - libgphoto2
   - gphoto2
   - imagemagick
   - gd
   - node-0.10.36 (node010)
     - This was the latest version that could use the gphoto2 npm module. node 0.12 changed the C++ interfaces to node

## Running
 - `sudo killall PTPCamera` (after plugging in camera)
 - `node ./bin/www`

 Not done yet, generates gallery in gallery_export.
 - `node galleryGen.js`

## Random Notes
If you're getting 500 errors when capturing make sure you're not shooting in RAW.
