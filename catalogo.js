/* StreamVe — catálogo público: qué se vende y a qué precio. */

const CAT = [
  { id:'nx', nombre:'Netflix',     cat:'VIDEO',  renovable:true,  mayor:2.60,
    color:'#E50914', logo:'assets/logos/netflix.svg',    img:'assets/nx.webp', card:'assets/cards/nx.webp',
    planes:[{k:'pantalla',etq:'Pantalla',precio:3.50,stock:14},{k:'perfil',etq:'Perfil',precio:2.80,stock:9},{k:'completa',etq:'Cuenta completa',precio:11.00,stock:3}] },
  { id:'dp', nombre:'Disney+',     cat:'VIDEO',  renovable:true,  mayor:2.20,
    color:'#113CCF', logo:'assets/logos/disney.svg',     img:'assets/dp.webp', card:'assets/cards/dp.webp',
    planes:[{k:'pantalla',etq:'Pantalla',precio:3.00,stock:11},{k:'completa',etq:'Cuenta completa',precio:9.00,stock:2}] },
  { id:'mx', nombre:'HBO Max',     cat:'VIDEO',  renovable:true,  mayor:2.05,
    color:'#002BE7', logo:'assets/logos/max.svg',        img:'assets/mx.webp', card:'assets/cards/mx.webp',
    planes:[{k:'pantalla',etq:'Pantalla',precio:2.80,stock:8},{k:'completa',etq:'Cuenta completa',precio:8.50,stock:2}] },
  { id:'pv', nombre:'Prime Video', cat:'VIDEO',  renovable:true,  mayor:1.85,
    color:'#00A8E1', logo:'assets/logos/prime.svg',      img:'assets/pv.webp', card:'assets/cards/pv.webp',
    planes:[{k:'pantalla',etq:'Pantalla',precio:2.50,stock:6}] },
  { id:'sp', nombre:'Spotify',     cat:'MÚSICA', renovable:true,  mayor:1.95,
    color:'#1DB954', logo:'assets/logos/spotify.svg',    img:'assets/sp.webp', card:'assets/cards/sp.webp',
    planes:[{k:'perfil',etq:'Cuenta individual',precio:2.60,stock:17}] },
  { id:'cr', nombre:'Crunchyroll', cat:'ANIME',  renovable:true,  mayor:1.60,
    color:'#F47521', logo:'assets/logos/crunchyroll.svg', img:'assets/cr.webp', card:'assets/cards/cr.webp',
    planes:[{k:'pantalla',etq:'Pantalla',precio:2.20,stock:5}] },
  { id:'pp', nombre:'Paramount+',  cat:'VIDEO',  renovable:false, mayor:1.55,
    color:'#0064FF', logo:'assets/logos/paramount.svg',  img:'assets/pp.webp', card:'assets/cards/pp.webp',
    planes:[{k:'pantalla',etq:'Pantalla',precio:2.10,stock:4}] }
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
