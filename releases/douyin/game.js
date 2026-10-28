


loadCC();


function loadCC() {
    require('./web-adapter');


    // Polyfills bundle.
    require("src/polyfills.bundle.js");


    // SystemJS support.
    require("src/system.bundle.js");

    // Adapt for IOS, swap if opposite
    if (canvas){
        var _w = canvas.width;
        var _h = canvas.height;
        if (screen.width < screen.height) {
            if (canvas.width > canvas.height) {
                _w = canvas.height;
                _h = canvas.width;
            }
        } else {
            if (canvas.width < canvas.height) {
                _w = canvas.height;
                _h = canvas.width;
            }
        }
        canvas.width = _w;
        canvas.height = _h;
    }

    // Adjust initial canvas size
    if (canvas && window.devicePixelRatio >= 2) {canvas.width *= 2; canvas.height *= 2;}

    const importMap = require("src/import-map.js").default;
    System.warmup({
        importMap,
        importMapUrl: 'src/import-map.js',
        defaultHandler: (urlNoSchema) => {
            require('.' + urlNoSchema);
        },
        handlers: {
            'plugin:': (urlNoSchema) => {
                typeof requirePlugin === 'function' ? requirePlugin(urlNoSchema) : require(urlNoSchema);
            },
            'project:': (urlNoSchema) => {
                require(urlNoSchema);
            },
        },
    });

    System.import('./application.js').then(({ Application }) => {
        return new Application();
    }).then((application) => {
        return onApplicationCreated(application);
    }).catch((err) => {
        console.error(err);
    });

    function onApplicationCreated(application) {
        return System.import('cc').then((cc) => {
            require('./engine-adapter');
            return application.init(cc);
        }).then(() => { return application.start(); });
    }

}
