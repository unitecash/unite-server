#!/usr/bin/env node

const fs           = require('fs')
const https        = require('https')
const express      = require('express')
const multiparty   = require('multiparty')
const stream       = require('stream')
const IPFS         = require('ipfs')
const bch          = require('bitcoincashjs')

// configuration options
const PORT                       = 5501
const ENABLE_SSL                 = true
const SSL_CERT_FILE              = '../cert.pem'
const SSL_KEY_FILE               = '../privkey.pem'
const ALLOW_CROSS_ORIGIN_LOADING = true

const MAX_FILE_UPLOAD_SIZE       = 500 * 1024 * 1024 // 500 MB
const MAX_HASH_DESCRIPTOR_SIZE   = 4096 // 4 KB
const API_VERSION                = 0.1
const DEBUG                      = true

const app = express()

// Get rid of CORS errors
if ( ALLOW_CROSS_ORIGIN_LOADING ) {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
    next()
  })
}

const log = (data) => {
  if (DEBUG) { console.log(data) }
}

const IPFSOptions = {
  relay: {
    enabled: true,
    hop: {
      enabled: true,
      active: true
    }
  },
  EXPERIMENTAL: {
    pubsub: true,
    sharding: true,
    dht: true
  },
  config: {
    Addresses: {
      swarm: [
        'ip4/0.0.0.0/tcp/4001',
        'ip4/0.0.0.0/tcp/4002',
        'ip4/0.0.0.0/tcp/4003/ws'
      ]
    }
  }
}

// start IPFS and then start listening for content
const IPFSNode = new IPFS(IPFSOptions)
IPFSNode.on('ready', () => {
  
  if ( ENABLE_SSL ) {
    var key = fs.readFileSync(SSL_KEY_FILE)
    var cert = fs.readFileSync(SSL_CERT_FILE)
    https.createServer({
      key: key,
      cert: cert
    }, app).listen(PORT)
  } else {
    app.listen(PORT)
  }
  
  console.log('Unite server has started and is ready for connections:')
  console.log('Listening on Port: ', PORT)
  console.log('Debug Mode:        ', DEBUG)
  console.log('SSL Enabled:       ', ENABLE_SSL)
  console.log('Allow CORS:        ', ALLOW_CROSS_ORIGIN_LOADING)
})

app.get('/', (req, res) => {
  log('[GET] /')
  res.send('Unite.cash API Endpoint')
})

app.get('/publish', (req, res) => {
  log('[GET] /publish')
  res.send('You must use POST to publish content.')
})

app.get('/pins', (req, res) => {
  log('[GET] /pins')
  IPFSNode.pin.ls((err, pinset) => {
    if (err) { throw err }
    res.send(pinset)
  })
})

app.get('/peers', (req, res) => {
  log('[GET] /peers')
  IPFSNode.swarm.peers((err, peers) => {
    if (err) { throw err }
    res.send(peers)
  })
})

app.get('/info', (req, res) => {
  log('[GET] /info')
  // build an info object to send to the client
  const info = {
    version: API_VERSION,
    maxFileSize: MAX_FILE_UPLOAD_SIZE
  }
  res.send(JSON.stringify(info))
})

app.post('/publish', (req, res) => {
  log('[POST] /publish')
  // Parse form data with multiparty
  const form = new multiparty.Form()
  form.parse(req, (err, fields, files) => {
    const signedTransaction = fields.signedTransaction[0]
    const hashDescriptor = fields.hashDescriptor[0]
    const fileArray = files.files
    
    // verify hashDescriptor is an object, and that it is compressed
    //hashDescriptor = JSON.stringify(JSON.parse(hashDescriptor))
    
    log('Hash descriptor size: ' + hashDescriptor.length)
    log('Number of files:      ' + fileArray.length)
    log('Signed transaction:\n' + signedTransaction)

    // [TODO] verify the signature on the transaction
    
    // [TODO] verify the transaction is otherwise valid per the Unite spec
    //        this includes referencing a valid parent TXID (if applicable),
    //        high enough fees so that it will actually be mined, etc.

    // calculate the IPFS hash of hashDescriptor
    const hashDescriptorFile = [
      {
        path: 'file',
        content: Buffer.from(hashDescriptor)
      }
    ]
    IPFSNode.files.add(hashDescriptorFile, {onlyHash: true}, (err, fileHashes) => {
      if (err) { throw err }
      const hashDescriptorHash = fileHashes[0].hash
      log('Calculated hashDescriptor\'s hash: ' + hashDescriptorHash)
      
      // [TODO] fileHashes[0].hash MUST be the same as is present in signedTransaction
        
      /*
        calculate the IPFS hash of each file sent and verify the hash is contained
        in hashDescriptor.
        
        Note that we don't verify that all files who's hashes were referenced in
        hashDescriptor were provided to this endpoint. This allows for clients to
        send only some of their files to some endpoints, further decentralizing
        the protocol.
      */
      
      // define an array to hold the file data to be added
      var dataFiles = []
      
      // for each file uploaded, add an object to dataFiles
      for (var i = 0; i < fileArray.length; i++) {
        dataFiles.push({
          path: 'file',
          content: Buffer.from(fs.readFileSync(fileArray[i].path))
        })
      }
      
      // calculate the hash of each file
      IPFSNode.files.add(dataFiles, {onlyHash: true}, (err, fileHashes) => {
      if (err) { throw err }
        var failVerifyHashes = false
        for (var i = 0; i < fileHashes.length; i++) {
          // verify hash is contained somewhere in hashDescriptor
          if (hashDescriptor.indexOf(fileHashes[i].hash) < 0) { failVerifyHashes = true; break; }
        }
        
        if (failVerifyHashes) {
          // one or more files did not have a hash that was in hashDescriptor
          res.status(400)
          res.send('Make sure the file hashes are in the signed hash descriptor!')
        } else {
        
          log('Verified the following hashes are in hashDescriptor:')
          for (var i = 0; i < fileHashes.length; i++) {
            log('Hash: ' + fileHashes[i].hash)
          }
          
          // add hash descriptor to IPFS
          IPFSNode.files.add(hashDescriptorFile, (err, fileHashes) => {
            if (err) { throw err }
            log('Added hash descriptor to IPFS!')
          
            // Add all files to IPFS
            IPFSNode.files.add(dataFiles, (err, fileHashes) => {
              if (err) { throw err }
              // [TODO] help the publisher by broadcasting their transaction
              res.send('Success!')
              log('Added files to IPFS!')
              
              // Pin the hashes on this node
              for (var i = 0; i < fileHashes.length; i++) {
                IPFSNode.pin.add(fileHashes[i].hash, (err) => {log(err)})
              }
              IPFSNode.pin.add(hashDescriptorHash, (err) => {log(err)})
            })
          })
        }
      })
    })
  })
})
