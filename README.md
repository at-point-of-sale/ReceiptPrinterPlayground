# ReceiptPrinterPlayground

Playground app for the @point-of-sale/ receipt printer libraries

Try it out at: https://point-of-sale.dev/receipt-printer/playground/

## The inspector

A second page of the same project, `inspector.html`, at https://point-of-sale.dev/receipt-printer/inspector/. It loads the raw data that was sent to a receipt printer, from a file, a drop or a link with the bytes in base64url behind `#data=`, and shows it three ways side by side: as a hex dump, as the paper the printer would print and as the commands it is made of, decoded. The paper can be saved as a PNG or an SVG, and the bytes can be printed to a printer over USB, serial or Bluetooth. Which language the bytes are read as is detected, and can be overruled by choosing a printer model.

## Deploying

The app is a Cloudflare Worker that serves the built files as static assets; `wrangler.toml` describes it. It has no hostname of its own: the website Worker of [point-of-sale.dev](https://github.com/at-point-of-sale/PointOfSale) puts it under the path above through a service binding.

```
npm run deploy
```

This builds the app and deploys it. Pushes to `main` deploy automatically once the repository is connected to the Worker in the Cloudflare dashboard, with `npm run deploy` as the deploy command. Every dependency is on npm, so a build on Cloudflare installs and builds the app as a machine with the checkouts does; `npm run link` puts the local checkouts of the libraries back for development.



<br>

-----

<br>

This webapp has been created by Niels Leenheer. The development of this webapp and the @point-of-sale/ printer libraries is sponsored by Salonhub.

<a href="https://salonhub.nl"><img src="https://point-of-sale.dev/logo.svg" width=100></a>
