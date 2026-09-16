# ReceiptPrinterPlayground

Playground app for the @point-of-sale/ receipt printer libraries

Try it out at: https://point-of-sale.dev/receipt-printer/playground/

## Deploying

The app is a Cloudflare Worker that serves the built files as static assets; `wrangler.toml` describes it. It has no hostname of its own: the website Worker of [point-of-sale.dev](https://github.com/at-point-of-sale/PointOfSale) puts it under the path above through a service binding.

```
npm run deploy
```

This builds the app and deploys it. Pushes to `main` deploy automatically once the repository is connected to the Worker in the Cloudflare dashboard, with `npm run deploy` as the deploy command. That waits for its dependencies to be on npm: the encoder at 4.0.0, the renderer and receiptline are installed through `npm link` today, which a build on Cloudflare cannot do, so until then it deploys from a machine that has the checkouts.



<br>

-----

<br>

This webapp has been created by Niels Leenheer. The development of this webapp and the @point-of-sale/ printer libraries is sponsored by Salonhub.

<a href="https://salonhub.nl"><img src="https://point-of-sale.dev/logo.svg" width=100></a>
