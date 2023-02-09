#!/usr/bin/env node

const fs = require('fs')
const execSync = require('child_process').execSync

log("")
log("8888888b.  888                        888          888                 8888888b. 8888888  .d8888b.   .d8888b.  ")
log("888   Y88b 888                        888          888                 888  \"Y88b  888   d88P  Y88b d88P  Y88b ")
log("888    888 888                        888          888                 888    888  888   Y88b.      888    888 ")
log("888   d88P 888  8888b.  888  888  .d88888  8888b.  888888  .d88b.      888    888  888    \"Y888b.   888        ")
log("8888888P\"  888     \"88b 888  888 d88\" 888     \"88b 888    d8P  Y8b     888    888  888       \"Y88b. 888        ")
log("888        888 .d888888 888  888 888  888 .d888888 888    88888888     888    888  888         \"888 888    888 ")
log("888        888 888  888 Y88b 888 Y88b 888 888  888 Y88b.  Y8b.         888  .d88P  888   Y88b  d88P Y88b  d88P ")
log("888        888 \"Y888888  \"Y88888  \"Y88888 \"Y888888  \"Y888  \"Y8888      8888888P\" 8888888  \"Y8888P\"   \"Y8888P\"  ")
log("                             888      ")                                                                         
log("                        Y8b d88P   ")                                                                            
log("                         \"Y88P\"  ")
log("")
log("Playdate Disc Creator")

execSync("sleep 1")

var MODE_IMG = "img"//Use an image for card.png if available, otherwise generate one
var MODE_NO_IMG = "nim"//Ignore any images in directory, always generate card.png
var MODE_IMAGE_AND_OVERLAY = "imo"//Use image cropped for card.png and also add overlay with album and title
var mode = MODE_IMG

//Default ImageMagick dither type, 
//'identify -list threshold' displays what built-in ordered dither options ImageMajick has
var ditherType = "h4x4a"
var labelCoords = "NorthWest"
var repoUrlOverride = ""
var keepProject = false

process.argv.forEach(function (val, index, array) {
    log("CLI argument: " + index + ': ' + val);
    if(val == "-cardmode"){
        var next = process.argv[index + 1]
        if(next == MODE_IMG) mode = MODE_IMG
        if(next == MODE_NO_IMG) mode = MODE_NO_IMG
        if(next == MODE_IMAGE_AND_OVERLAY) mode = MODE_IMAGE_AND_OVERLAY
    }

    if(val == "-ditherType"){
        ditherType = process.argv[index + 1]
    }

    if(val == "-labelCoords"){
        labelCoords = process.argv[index + 1]
    }

    if(val == "-useFork"){
        repoUrlOverride = process.argv[index + 1]
    }

    if(val == "-keepProject"){
        keepProject = true
    }
});

let cwd = process.cwd()
log("Working directory: " + cwd)

//Delete any previously cloned Playdate repo, or card attempt
execSync("rm -f -r ./playdate_disc")
execSync("rm -f -r card.png")

log("Cloning Playdate Disc project...")
if(repoUrlOverride != ""){
    execSync("git clone " + repoUrlOverride)
}else{
    execSync("git clone https://github.com/orllewin/playdate_disc.git")
}

log("Deleting Playdate Disc project example wavs...")
execSync("find ./playdate_disc/Source/Audio -name \"*.wav\" -type f -delete")

//and any old metadata...
execSync("find ./ -name \"*metadata.txt\" -type f -delete")

var album = ""
var artist = ""
var albumArtist = ""

var imageFilename = ""

var pl = {};
var tracks = []
pl.tracks = tracks

fs.readdir(cwd, (error, files) => {
    if (error) log("error: " + error)
   
    for (var i = 0; i < files.length; i++) { 
        let file = files[i]
        log("Inspecting: " + file)
        if(file.toLowerCase().endsWith(".png") || file.toLowerCase().endsWith(".jpg") || file.toLowerCase().endsWith(".jpeg")){
            log("Found image: " + file)
            imageFilename = file
        }
        if(file.toLowerCase().endsWith(".mp3")){
            log("Found mp3: " + file)
             const metadataFilename = file.toLowerCase().replace(/[^a-z0-9]/gi, '') + "_metadata.txt"
        
             execSync("ffmpeg -i '" + file + "' -f ffmetadata " + metadataFilename)

             var title = ""

             require('fs').readFileSync(metadataFilename, 'utf-8').split('\n').forEach(line => {
                if(line.startsWith("album=")){
                    album = line.substring(6)
                }
                if(line.startsWith("album_artist=")){
                    albumArtist = line.substring(13)
                }
                if(line.startsWith("artist=")){
                    artist = line.substring(7)
                }
                if(line.startsWith("title=")){
                    title = line.substring(6)
                }
             });

             const wavFile = file.replace(".mp3", "")
             var track = {
                "title": title,
                "file": wavFile
              }
              pl.tracks.push(track)
        }
    }

    pl.title = album
    pl.artist = artist

    if(albumArtist != "")  pl.artist = albumArtist

    execSync("rm ./playdate_disc/Source/playlist.json")
    fs.writeFileSync('./playdate_disc/Source/playlist.json', JSON.stringify(pl, null, 2))

    //Create pdxinfo
    execSync("rm ./playdate_disc/Source/pdxinfo")
    var albumIdentifier = album.toLowerCase().replace(/[^a-z0-9]/gi, '')

    var pdxinfo = "name=PDDisc " + album + "\nauthor=Playdate Disc Creator\nbundleID=orllewin.pddisccreator." + albumIdentifier + "\nversion=1.0.0\nimagePath=Images/"
    fs.writeFileSync('./playdate_disc/Source/pdxinfo', pdxinfo)

    log("Creating card.png")
    log("Artist: " + artist)
    log("Album artist: " + albumArtist)
    log("Album: " + album)

    if(albumArtist != "") artist = albumArtist

    //Create card
    if(imageFilename == "" || mode == MODE_NO_IMG){
        //No image, so make one
        execSync("convert -size 350x155 canvas:black card_temp.png")

        //Create text, save as text.png
        execSync("convert -background black  -fill white  -font Helvetica -size 320x130 caption:'" + album + ": " + artist + "' text.png")  

        //Combine
        execSync("magick card_temp.png text.png -gravity Center -composite ./playdate_disc/Source/Images/card.png")

        //Copy locally so user can evaluate:
        execSync("cp ./playdate_disc/Source/Images/card.png card.png")

        execSync("rm text.png")
        execSync("rm card_temp.png")
    }else{
        if(mode == MODE_IMAGE_AND_OVERLAY){
            //Use existing cropped image, but also add text overlay in black box...
            //Resize and crop to temp.png
            execSync("convert '" + imageFilename + "' -resize 350x155^ -gravity Center -crop 350x155+0+0 +repage card_temp.png")

            //Ordered dither:
            execSync("convert card_temp.png  -colorspace Gray -ordered-dither " + ditherType + " card_temp.png")

            //Create text, save as text.png
            execSync("convert -background black  -fill white  -font Helvetica -size 200x50 caption:'" + album + ": " + artist + "' text.png")      

            //Combine
            execSync("magick card_temp.png text.png -gravity " + labelCoords + " -composite ./playdate_disc/Source/Images/card.png")

            //Copy locally so user can evaluate:
            execSync("cp ./playdate_disc/Source/Images/card.png card.png")

            execSync("rm card_temp.png")
            execSync("rm text.png")
        }else{
            //Just used the existing image and crop it
            execSync("convert '" + imageFilename + "' -resize 350x155^ -gravity Center -crop 350x155+0+0 +repage card_temp.png")
            execSync("convert card_temp.png  -colorspace Gray -ordered-dither " + ditherType + " ./playdate_disc/Source/Images/card.png")

            //Copy locally so user can evaluate:
            execSync("cp ./playdate_disc/Source/Images/card.png card.png")

            execSync("rm ./card_temp.png")
        }
    }

    //Audio conversion:
    log("Converting Mp3 to Wav and copying to Playdate Disc project...")
    execSync("for f in *.mp3; do ffmpeg -i \"${f}\" -acodec adpcm_ima_wav \"./playdate_disc/Source/Audio/${f%%.*}.wav\"; done")

    //Playdate compiler:
    execSync("pdc ./playdate_disc/Source/ " + albumIdentifier + ".pdx")

    //tidy up:
    execSync("find ./ -name \"*metadata.txt\" -type f -delete")

    if(!keepProject) execSync("rm -f -r ./playdate_disc")
})

function log(message){
    console.log(message)
}
