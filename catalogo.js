/* StreamVe — catálogo público: qué se vende y a qué precio.

   `color`  color de marca — tiñe la foto de fondo y la muesca de la tarjeta
   `logo`   SVG en assets/logos/. Si falta, la tarjeta cae al nombre escrito
   `img`    foto de fondo en assets/. Si falta, cae a la trama monocroma
   `card`   tarjeta ya renderizada. Declararla solo si el archivo existe

   Precios por plan: `precio` es el público y `precioMayorista` el de
   revendedor (null = no se vende al mayor). El stock NO va acá: sale de
   las cuentas madre en datos.js, que es lo que de verdad hay. */

const CAT = [
  { id:'nx', nombre:'Netflix',     cat:'VIDEO',  renovable:true,
    color:'#E50914', logo:'assets/logos/netflix.svg',    img:'assets/nx.webp', card:'assets/cards/nx.webp',
    planes:[{k:'pantalla',etq:'Pantalla',precio:6.00,precioMayorista:4.50},
            {k:'completa',etq:'Cuenta completa',precio:20.00,precioMayorista:null}] },
  { id:'dp', nombre:'Disney+',     cat:'VIDEO',  renovable:true,
    color:'#113CCF', logo:'assets/logos/disney.svg',     img:'assets/dp.webp', card:'assets/cards/dp.webp',
    planes:[{k:'pantalla',etq:'Pantalla',precio:5.00,precioMayorista:3.75},
            {k:'completa',etq:'Cuenta completa',precio:16.00,precioMayorista:null}] },
  { id:'mx', nombre:'HBO Max',     cat:'VIDEO',  renovable:true,
    color:'#002BE7', logo:'assets/logos/max.svg',        img:'assets/mx.webp', card:'assets/cards/mx.webp',
    planes:[{k:'pantalla',etq:'Pantalla',precio:5.00,precioMayorista:3.75},
            {k:'completa',etq:'Cuenta completa',precio:12.00,precioMayorista:null}] },
  { id:'pv', nombre:'Prime Video', cat:'VIDEO',  renovable:true,
    color:'#00A8E1', logo:'assets/logos/prime.svg',      img:'assets/pv.webp', card:'assets/cards/pv.webp',
    planes:[{k:'pantalla',etq:'Pantalla',precio:4.00,precioMayorista:3.00}] },
  { id:'sp', nombre:'Spotify',     cat:'MÚSICA', renovable:true,
    color:'#1DB954', logo:'assets/logos/spotify.svg',    img:'assets/sp.webp', card:'assets/cards/sp.webp',
    planes:[{k:'individual',etq:'Cuenta individual',precio:3.50,precioMayorista:2.60}] },
  { id:'cr', nombre:'Crunchyroll', cat:'ANIME',  renovable:true,
    color:'#F47521', logo:'assets/logos/crunchyroll.svg', img:'assets/cr.webp', card:'assets/cards/cr.webp',
    planes:[{k:'pantalla',etq:'Pantalla',precio:3.50,precioMayorista:2.60}] },
  { id:'pp', nombre:'Paramount+',  cat:'VIDEO',  renovable:false,
    color:'#0064FF', logo:'assets/logos/paramount.svg',  img:'assets/pp.webp', card:'assets/cards/pp.webp',
    planes:[{k:'pantalla',etq:'Pantalla',precio:3.50,precioMayorista:2.60}] }
];

/* Qué es cada servicio, en una línea. Se despliega al pasar el mouse. */
const DESC = {
  nx:'Series y películas originales. El plan Premium da 4K y cuatro pantallas.',
  dp:'Disney, Pixar, Marvel, Star Wars y ESPN en un mismo lugar.',
  mx:'HBO, DC y Warner. Los estrenos de cine llegan acá primero.',
  pv:'Cine, series y todos los originales de Amazon.',
  sp:'Música sin anuncios, sin conexión y sin saltos limitados.',
  cr:'Anime en simulcast, subtitulado y doblado al español.',
  pp:'Paramount, MTV, Nickelodeon y CBS, con fútbol incluido.'
};
