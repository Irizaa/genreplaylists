const { promisify } = require('util')
const delay = promisify(setTimeout)
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
    
    let currLink = 'me/tracks?offset=0&limit=50'
    let songs: any[] = []
  
    // while (currLink !== null) { // Commenting this out for easier testing. Will add it back in when functionality is guaranteed.
      try {
        const response = await axios.get(currLink)
        songs.push(...response.data.items)
        currLink = response.data.next
      } catch (err) {
        console.error(err)
        throw new Error('Failed to retrieve liked songs.')
      }
    // }
  
    return songs
  };
  
const createPlaylist = (genre: string, userID: string) => {
    axios({
        method: 'post',
        url: `users/${userID}/playlists`,
        data: {
            "name": `${genre}`
        }
    })
}  
const getUserID = () => {
    return axios.get('me')
    .then((response:any) => response.data.id)
    .catch((error:any) => {
        console.log(error);
        throw error; // Rethrow the error to be caught later, if needed
    });
}

app.get('/results', async (req, res) => {
    const access_token = req.query.access_token
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
    let userID:any
    try {
        userID = await getUserID()
        console.log(userID)
    } catch (error) {
        console.log(error)
    }

    console.log(userID)
    let map:string[] = []

    getLikedSongs(access_token)
    .then((songs) => {
      for(let i = 0; i < songs.length; i++) {
        let currArtist = songs[i].track.artists[0].id
        console.log(currArtist)
        
        axios.get(`/artists/${currArtist}`)
        .then((response:any) => {
            let currGenres = response.data.genres
            for(let j = 0; j < currGenres.length; j++) {
                let currGenre = currGenres[j]
                console.log(currGenre)
                
                if(!map.includes(currGenre)) {
                    createPlaylist(currGenre, userID)
                    map.push(currGenre)
                }
            }
        })
        .catch((error:any) => {
            console.log(error)
        })
        
      }
    })
    .catch((err) => {
      console.error(err);
    });
    // Iterate through every song in user's liked library. \DONE
    // At every song, get the Spotify ID of the artist for that song. \DONE
    // Then, with that ID, get the artist's genres. (https://developer.spotify.com/documentation/web-api/reference/get-an-artist) \DONE
    // Map ====> Key(STRING): Genre | Value(STRING[]): List of songs.
    // If the genre does not exist as a playlist, create it. Then, add the song to the genre playlist.
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