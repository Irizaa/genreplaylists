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
    return axios({
        method: 'post',
        url: `users/${userID}/playlists`,
        data: {
            "name": `${genre}`
        }
    })
    .then((response:any) => response.data.id)
    .catch((error:any) => {
        console.log(error)
        throw error
    });
    
} 
const getUserPlaylists = async (userID: string) => {
    let currLink = `users/${userID}/playlists?offset=0&limit=50`
    let playlists: any[] = []

    while(currLink !== null) {
        try {
            const response = await axios.get(currLink)
            playlists.push(...response.data.items)
            currLink = response.data.next
        } catch (err){
            console.error(err)
            throw new Error('Failed to retrieve user playlists.')
        }
    }
    return playlists
    // let currLink = 'me/tracks?offset=0&limit=50'
    // let songs: any[] = []
  
    // // while (currLink !== null) { // Commenting this out for easier testing. Will add it back in when functionality is guaranteed.
    //   try {
    //     const response = await axios.get(currLink)
    //     songs.push(...response.data.items)
    //     currLink = response.data.next
    //   } catch (err) {
    //     console.error(err)
    //     throw new Error('Failed to retrieve liked songs.')
    //   }
    // // }
  
    // return songs
} 
const getUserID = () => {
    return axios.get('me')
    .then((response:any) => response.data.id)
    .catch((error:any) => {
        console.log(error)
        throw error
    });
}

app.get('/results', async (req, res) => {
    const access_token = req.query.access_token
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
    const genrePlaylistMap = new Map()

    try {
      const userID = await getUserID()
      console.log(userID)

      const playlists = await getUserPlaylists(userID)
      console.log(playlists)
      res.send('2')
      const songs = await getLikedSongs(access_token)
  
      for (let i = 0; i < songs.length; i++) {
        const currArtist = songs[i].track.artists[0].id
        console.log(currArtist)
  
        try {
          const response = await axios.get(`/artists/${currArtist}`)
          const currGenres = response.data.genres
  
          for (let j = 0; j < currGenres.length; j++) {
            const currGenre = currGenres[j]
            console.log(currGenre)
  
            if (!genrePlaylistMap.has(currGenre)) {
              try {
                const playlistID = await createPlaylist(currGenre, userID)
                genrePlaylistMap.set(currGenre, playlistID)
                // delay of 1 second between API requests
                await new Promise((resolve) => setTimeout(resolve, 1000))
              } catch (error) {
                console.log(error)
              }
            }
          }
        } catch (error) {
          console.log(error)
        }
      }
    } catch (error) {
      console.log(error)
    }
  
    res.send('Hey!')
  });



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