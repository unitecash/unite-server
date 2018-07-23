const express = require('express')
const multiparty = require('multiparty')
const { spawn } = require('child_process')
const stream = require('stream')

const app = express()

app.get('/', (req, res) => {
  res.send('Unite.cash Content Publishing API Endpoint')
})

app.post('/publish', (req, res) => {
  var form = new multiparty.Form()
  form.parse(req, (err, fields, files) => {
    console.log(fields)
    console.log(files)

    // pull out some variables
    var rawtx = fields.rawtx[0]
    var hashDescriptor = JSON.parse(fields.hashDescriptor[0])

    // verify the hashes with the ones provided
    console.log('running: ipfs add...')
    var child = spawn('ipfs', ['add'])

    child.stdout.on('data', (data) => {
      var hashDescriptorHash = data.toString().split(' ')[1]
      console.log('Added hash descriptor hash to IPFS: ' + hashDescriptorHash)

      console.log('pinning the hash...')
      child = spawn('ipfs', ['pin', 'add', hashDescriptorHash])
      child.stdout.on('data', (data) => {
        console.log(data.toString())

        // add the file itself
        console.log('running ipfs add ' + files.files[0].path)
        child = spawn('ipfs', ['add', files.files[0].path])
        child.stdout.on('data', (data) => {
          var fileHash = data.toString().split(' ')[1]
          console.log('added ' + fileHash)
        })

      })

    })

    var stdinStream = new stream.Readable()
    stdinStream.push(fields.hashDescriptor[0])  // Add data to the internal queue for users of the stream to consume
    stdinStream.push(null)   // Signals the end of the stream (EOF)
    stdinStream.pipe(child.stdin)

    res.status(200)
    res.send('success')
  })
})

app.listen(5501, () => console.log('Example app listening on port 5501!'))
