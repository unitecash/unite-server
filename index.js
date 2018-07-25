const express = require('express')
const multiparty = require('multiparty')
const { spawn } = require('child_process')
const stream = require('stream')

// configuration options
const PORT = 5501
const MAX_FILE_UPLOAD_SIZE = 550000000

const app = express()

app.get('/', (req, res) => {
  res.send('Unite.cash API Endpoint')
})

app.post('/publish', (req, res) => {
  console.log('A POST request was received to publish content')
  var form = new multiparty.Form()
  form.parse(req, (err, fields, files) => {
    console.log('Parsed form data with multiparty')
    // pull out some variables
    var rawtx = fields.rawtx[0]
    var hashDescriptor = JSON.parse(fields.hashDescriptor[0])

    var child = spawn('ipfs', ['add'])

    child.stdout.on('data', (data) => {
      var hashDescriptorHash = data.toString().split(' ')[1]
      console.log(
        'Added the hash descriptor\'s hash to IPFS:',
        hashDescriptorHash
      )

      console.log('Pinning the hash...')
      child = spawn('ipfs', ['pin', 'add', hashDescriptorHash])
      child.stdout.on('data', (data) => {
        console.log(data.toString())

        // add the file itself
        child = spawn('ipfs', ['add', files.files[0].path])
        child.stdout.on('data', (data) => {
          var fileHash = data.toString().split(' ')[1]
          console.log(
            'Added',
            fileHash,
            'to IPFS!'
          )
        })

      })

    })

    console.log('Pushing HD data to IPFS via stdin')
    var stdinStream = new stream.Readable()
    stdinStream.push(fields.hashDescriptor[0])  // Add data to the internal queue for users of the stream to consume
    stdinStream.push(null)   // Signals the end of the stream (EOF)
    stdinStream.pipe(child.stdin)

    console.log('Sendins message with status code 200')
    res.status(200)
    res.send('success')
  })
})

app.listen(PORT, () => {
  console.log('Unite API exposed on port ', PORT)
})
