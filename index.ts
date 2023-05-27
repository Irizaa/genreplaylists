require ('dotenv').config()
const axios = require('axios')
import express from 'express';
axios.defaults.headers.common['accept-encoding'] = 'null';

const app = express()
const port = 3000

const stateGenerator = ():string => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
    let ret = ""
    for(let i = 0 ; i < 21 ; i++) {
        ret+=  alphabet.charAt(Math.floor(Math.random() * alphabet.length))
    }
    return ret;
}

const state = stateGenerator()
const clientID = process.env.CLIENT_ID
const redirectURI = process.env.REDIRECT_URI
const clientSecret = process.env.CLIENT_SECRET
const scope = 'user-library-read%20playlist-read-private%20playlist-modify-private%20playlist-modify-public'



app.get("/login", (req, res) => {
    res.redirect(`https://accounts.spotify.com/authorize?client_id=${clientID}&response_type=code&redirect_uri=${redirectURI}&state=${state}&scope=${scope}&show_dialog=true`)
})

axios.defaults.baseURL = 'https://api.spotify.com/v1/'

const getLikedSongs = async (access_token:any) => {
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    let currLink = 'me/tracks?offset=0&limit=50';
    let songs: any[] = [];
  
    while (currLink !== null) {
      try {
        const response = await axios.get(currLink);
        songs.push(...response.data.items);
        currLink = response.data.next;
      } catch (err) {
        console.error(err);
        throw new Error('Failed to retrieve liked songs.');
      }
    }
  
    return songs;
  };
  

app.get('/results', (req, res) => {
    const access_token = req.query.access_token
    getLikedSongs(access_token)
    .then((songs) => {
      console.log(songs); // Do something with the liked songs
    })
    .catch((err) => {
      console.error(err);
    });
    // Iterate through every song in user's liked library.
    // At every song, check through all the genres of that song.
    // Check if playlist with that genre name exists. If it doesn't, create it and add the song.
    // If it does exist, check if that song exists within the playlist. If it doesn't, add the song. If it does, do nothing.
    res.send('Hey!')
})



app.get("/callback", (req, res) => {

    if(req.query.state!= state || req.query.error) {
        res.redirect('http://localhost:3000')
        return
    }
    const code = req.query.code
    
    axios({
        method: 'post',
        url: 'https://accounts.spotify.com/api/token',
        data: {
            grant_type: "authorization_code",
            code: code,
            redirect_uri: redirectURI
        },
        headers: {
            'Authorization': 'Basic ' + Buffer.from(clientID + ':' + clientSecret).toString('base64'),
            'content-type': 'application/x-www-form-urlencoded',
        },
    })
    .then((response: any) => {
        console.log(response.data.access_token)
        res.redirect(`http://localhost:3000/results?access_token=${response.data.access_token}&token_type=Bearer&refresh_token=${response.data.refresh_token}&expires_in=3600`)
    })
    .catch((error: any) => {
        res.send(error)
    })
})



app.listen(port, () => {
    console.log(`Server active on port ${port}`)
})