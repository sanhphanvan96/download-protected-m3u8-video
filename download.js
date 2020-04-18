const fs = require('fs')
const path = require('path')
const axios = require('axios');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

var base_url = 'https://cdn.webtiengnhat.com'

// get from browser's network tool
// NOTES: change it
var nUrl = base_url + '/list/pvdupload/smil:1544355855-3faa7fca8747da87d8cbfcd77647b130e856a2bf-5c0d000f0d0fb-ng-phap-n3-online-uchini-1.smil/1544355855-3faa7fca8747da87d8cbfcd77647b130e856a2bf-5c0d000f0d0fb-ng-phap-n3-online-uchini-1.mp4_chunk.m3u8?nimblesessionid=97020';

async function downloadFile(url, path) {
    console.log('Downloading ' + url);
    const writer = fs.createWriteStream(path)

    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    })

    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
    })
}

var nNumOfParts = 0;

function getPartUrl(num) {
    return nUrl.replace('mp4_chunk.m3u8', 'mp4-n_' + num + '_0_0.ts');
}

async function getTsUrl(num) {
    let rs = await axios.get(base_url + "/video/touch.php");
    let token = rs.data;
    console.log({ token });
    let tsUrl = getPartUrl(num) + "&token=" +
        function (_token) {
            {
                var c = "";
                var base64characters = "123456780ABCDEFGHKLMNOPYTRQW";
                for (var i = 0; i < _token.length; i++) {
                    if (i % 2 == 0) {
                        c += _token[i]
                    } else {
                        c += base64characters[Math.floor((Math.random() * base64characters.length))];
                        c += _token[i]
                    }
                };
                return c
            }
        }(token);
    return tsUrl;
};

async function downloadTsFile(tsUrl) {
    console.log({
        'Downloading ts' : tsUrl
    });
    let filename = tsUrl.split('?')[0].split(':').reverse()[0].split('/')[1];
    const filePath = path.resolve(__dirname, 'data', filename)
    const writer = fs.createWriteStream(filePath)

    const response = await axios({
        url: tsUrl,
        method: 'GET',
        responseType: 'stream'
    })

    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
    })
}

// NOTES: you must install ffmpeg first
function convertTs2Mp4() {
    return require('child_process').execSync(
        'ffmpeg -allowed_extensions ALL -protocol_whitelist file,https,http,crypto,data,tls -i '
        + path.resolve(__dirname, 'data', 'in.m3u8') + ' -hls_time 10 -c copy -bsf:a aac_adtstoasc '
        + path.resolve(__dirname, 'data', 'output.mp4') + ' -loglevel debug -y',
        {
            stdio: 'inherit'
        }
    );
}

async function download(numOfParts) {
    // download m3u8 file
    let _m3u8Path = path.resolve(__dirname, 'data', '_in.m3u8')
    await downloadFile(nUrl, _m3u8Path)

    // regenerate m3u8 file
    let m3u8Path = path.resolve(__dirname, 'data', 'in.m3u8')
    fs.readFile(_m3u8Path, 'utf8', function (err, data) {
        if (err) {
            return console.log(err);
        }
        var result = data.replace(/\?nimblesessionid=[0-9]*/g, '')
        // get number of Ts files
        nNumOfParts = data.match(/ts/gm).length
        console.log({ nNumOfParts })

        fs.writeFile(m3u8Path, result, 'utf8', function (err) {
            if (err) return console.log(err);
        });
    });

    // download hls key
    let hlsPath = path.resolve(__dirname, 'data', 'hls.key')
    let hlsKeyurl = nUrl.replace(/\.smil\/.*m3u8/g, '.smil/hls.key')
    console.log('hls key', hlsKeyurl)
    await downloadFile(hlsKeyurl, hlsPath)

    // download all Ts files
    for (var i = 0; i < nNumOfParts; i++) {
        try {
            let tsUrl = await getTsUrl(i)
            await downloadTsFile(tsUrl);
        } catch (error) {
            console.log(error)
            process.exit()
        }
    }
    await convertTs2Mp4();
    console.log({
        'Output': path.resolve(__dirname, 'data', 'output.mp4')
    })
}

download(nNumOfParts);
