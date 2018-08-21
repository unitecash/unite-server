# unite-server

This server receives content from Unite client applications,
hosting their content on IPFS and helping to seed it to
others.

## Installation

Make sure you have git and the latest version of npm, then do:

```
git clone https://github.com/unitecash/unite-server
cd unite-server
npm install
```

## Running the Server

```
./app.js
```

## Running at Boot

```
npm -g install pm2
pm2 startup
# Follow the instructions for your operating system (if any)
pm2 start app.js
pm2 save
```

Reboot and test to see if it works.

## Configuration

You may view and edit configuration variables in app.js.
By default, the server will listen on port 5501.

## Tips

You may see what your server is hosting by checking /pins.
By default, this is ```http://localhost:5501/pins```.
Node info and connected peers can be viewed at /info and /peers respectively.

## Contributing

Pull requests, feedback and ieas welcome. Note that this project is in pre-alpha,
so every aspect of the project may change without notice.

## Donations

Donations are accepted to the below Bitcoin Cash address:

```
bitcoincash:qra4cts50zs0spfuwk94yae5a57t073jps5hae847u
```

## Forks

Fork the project! Competing implementations help keep the protocol decentralized.
Forks, copies or snippets from this codebase must be open source, in accordance
with AGPL 3.0.

## License

This project is licensed under the terms of the GNU AGPL 3.0 license.
