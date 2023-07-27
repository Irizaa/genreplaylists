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

// Create function with parameters of playlist_id which get's a users items from the current playlist. It should return a list of all 
// song URIs from that playlist. We then cross-check the song-URIs we gathered with the song URIs in the current map value in the loop iteration.
// If the URI is in the map, remove it.
// Accomplish this with the Get Playlist Items Spotify API path. (GET /playlists/{playlist_id}/tracks)

const filterPlaylistSongURIs = async(playlistID:string, uris:string[]) => {
  let currLink = `playlists/${playlistID}/tracks`
  let playlistSongs:any[] = []
  while(currLink !== null) {
    try {
      const response = await axios.get(currLink)
      for(let i = 0; i < response.data.items.length; i++) {
        playlistSongs.push(response.data.items[i].track.uri)
      }
      currLink = response.data.next
    } catch (err) {
      console.error(err)
    }
  }
  const filteredURIs = uris.filter((uri) => !playlistSongs.includes(uri))
  return filteredURIs
}

const getLikedSongs = async (access_token:any) => {
    let currSongs = 50
    let currLink = 'me/tracks?offset=0&limit=50'
    let songs: any[] = []
  
    while (currLink !== null) { // Commenting this out for easier testing. Will add it back in when functionality is guaranteed.
      try {
        const response = await axios.get(currLink)
        console.log(`${currSongs} + completed`)
        currSongs+=50
        songs.push(...response.data.items)
        currLink = response.data.next
      } catch (err) {
        console.error(err)
        throw new Error('Failed to retrieve liked songs.')
      }
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  
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

app.get('/delete', async (req, res) => {

  const userID = await getUserID()

  const myPlaylists = ['Hey... I Won.', 'songs from before', '3 memories?', '2 chaeyoungdancecompilation', '1 sooo', '4 danny', 'PLAY']
  const allPlaylists = await getUserPlaylists(userID)

  for(let i = 0; i < allPlaylists.length; i++) {
    if(!myPlaylists.includes(allPlaylists[i].name)) {
      axios.delete(`playlists/${allPlaylists[i].id}/followers`)
      .then((response:any) => {
        console.log(`Deleted playlist: ${allPlaylists[i].name}`)
      })
      .catch((error:any) => {
        console.log(`Failed to delete playlist ${allPlaylists[i].name} `)
      })
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
  res.send('yo')
})


app.get('/results', async (req, res) => {

    // Save access token and set authorization header for API as default.
    const access_token = req.query.access_token
    const refresh_token = req.query.refresh_token
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
    const genrePlaylistMap = new Map()
    const songMap = new Map()

    try {
      // Get userID, then use that to get a list of user playlists. Add all the playlists to the map.
      const userID = await getUserID()
      console.log(`user ID obtained: ${userID}`)

      const playlists = await getUserPlaylists(userID)
      console.log('playlists obtained')

      for(let i = 0; i < playlists.length; i++) {
        if(playlists[i].owner.id == userID) {
            genrePlaylistMap.set(playlists[i].name, playlists[i].id) // genre name | genre id
            songMap.set(playlists[i].id, []) // genre id | songs needed to be added to that genre id
        }
      }

      res.send('2')

      // Get user's liked songs, then iterate through each one and add it to the respective genre playlist.
      let counter = 0
      const songs = await getLikedSongs(access_token)
  
      for (let i = 0; i < songs.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 200))
        const currSong = songs[i]
        const currArtist = currSong.track.artists[0].id
        // console.log(currArtist)
  
        try {
          const response = await axios.get(`/artists/${currArtist}`)
          const currGenres = response.data.genres
  
          for (let j = 0; j < currGenres.length; j++) {
            const currGenre = currGenres[j]
            // console.log(currGenre)

            // pop: 1,2,3,4,5
            if (!genrePlaylistMap.has(currGenre)) {
              try {
                const playlistID = await createPlaylist(currGenre, userID) // Get the ID for the genre-playlist we just created
                songMap.set(playlistID, []) // Create the song-map key-value pair for that playlist
                genrePlaylistMap.set(currGenre, playlistID) // Update genre-playlist map (add current genre | genre-playlist ID)
                console.log(`Created new playlist for ${currGenre}`) // 
                // delay of 1 second between API requests
              } catch (error) {
                console.log('error adding playlist to map')
              }
            }
            const playlistID = genrePlaylistMap.get(currGenre)
            // console.log("TRACK ID:" + currSong.track.uri)
            // 
            songMap.get(playlistID).push(currSong.track.uri)
            await new Promise((resolve) => setTimeout(resolve, 200))
          }
        } catch (error) {
          console.log(error)
        }
        counter++
        if(counter % 200 === 0) {
          axios.get(`http://localhost:3000/refresh_token?refresh_token=${refresh_token}` )
          .then((response:any) => {
            axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`
          })
        }
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    } catch (error) {
      console.log(error)
    }
    // songMap already has every keyvalue pair [playlist ID of genre | all the songs IDS to be added to that playlist]
    for (const [playlistID, uris] of songMap) {
      if (uris.length > 0) {
        // console.log("Playlist ID:", playlistID)
        // console.log("Joined URIs:", uris)
        try {
          const filteredURIs = await filterPlaylistSongURIs(playlistID, uris)
          axios({
            method: 'post',
            url: `playlists/${playlistID}/tracks`,
            data: {
              uris: filteredURIs,
            }
          })
          .then((response:any) => {
            console.log(`Songs added to playlist ${playlistID}`)
          })
          .catch((error:any) => {
            console.log('Error adding songs to playlist')
          })
        } catch (error) {
          console.log('Error processing playlists')
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
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

app.get('/refresh_token', (req, res) => {
  
  const refresh_token = req.query.refresh_token
  axios({
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      data: {
          grant_type: 'refresh_token',
          refresh_token: refresh_token
      },
      headers: {
          'Authorization': 'Basic ' + Buffer.from(clientID + ':' + clientSecret).toString('base64'),
          'content-type': 'application/x-www-form-urlencoded'
      }
  })
  .then((response:any) => {
      res.send(response.data)
  })
  .catch((error:any) => {
      res.send(error)
  })
})