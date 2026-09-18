import ReceiptPrinterEncoder from "@point-of-sale/receipt-printer-encoder";
import * as ReceiptLine from "@point-of-sale/receiptline";

/* How long a script is given before it is left to itself. A script that waits
   for something that never comes would otherwise hold the queue below for the
   life of the page */

const LIMIT = 10000;

/* One script at a time.

   A script is run with `console.warn` patched, so that what the encoder
   complains about is shown beside the output rather than in a console nobody
   has open. Two scripts running at once would patch the patch and put the
   original back the wrong way round, and the console would stay patched for
   good, so every call waits for the one in front of it */

let queue = Promise.resolve();

const getEncoder = (options) => {
    let result = queue.then(() => run(options));

    /* The queue moves on whatever became of the call in front of it */

    queue = result.then(() => {}, () => {});

    return result;
}

const run = async (options) => {

    /* Get printer model */

    let models = ReceiptPrinterEncoder.printerModels;
    let model = models.find(model => model.id === options.printerModel);

    if (model) {
        model = model.name;
    } else {
        model = 'Generic';
    }

    /* Set options */

    let encoderOptions = {
        receiptline: ReceiptLine
    };

    if (options.printerModel) {
        encoderOptions.printerModel = options.printerModel;
    }

    /* Values reported by the connected printer win over the model */

    if (options.language) {
        encoderOptions.language = options.language;
    }

    if (options.codepageMapping) {
        encoderOptions.codepageMapping = options.codepageMapping;
    }

    if (options.columns) {
        encoderOptions.columns = options.columns;
    }

    /* Create encoder */

    let encoder;

    let errors = [];
    let script_error = null;

    let warn = console.warn;

    console.warn = function(e) {
        warn(e);
        errors.push(e);
    }

    try {
        let script = null;

        try {
            encoder = new ReceiptPrinterEncoder(encoderOptions);

            /* The script is a function of its own, and what it returns is the
               promise it finishes with: a script that awaits is awaited */

            script = eval(`
                (async function() {
                    ${options.value}
                })();
            `);

            /* A script that fails after its time is up fails into nothing,
               which is not an unhandled rejection */

            if (script && typeof script.catch === 'function') {
                script.catch(() => {});
            }
        }
        catch (e) {
            /* A script that does not parse, and a model the encoder refuses */

            script_error = e;
        }

        if (!script_error && script) {
            let timer = null;

            let limit = new Promise((resolve, reject) => {
                timer = setTimeout(
                    () => reject('The script did not finish within ten seconds'), LIMIT);
            });

            try {
                await Promise.race([ script, limit ]);
            }
            catch (e) {
                script_error = e;
            }
            finally {
                clearTimeout(timer);
            }
        }
    }
    finally {
        /* Whatever happened, the console is the console again */

        console.warn = warn;
    }

    if (script_error) {
        errors.push(script_error);
        return { errors };
    }

    return { encoder, errors };
}

export { getEncoder };
