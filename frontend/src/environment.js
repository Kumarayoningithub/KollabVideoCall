
// const IS_PROD = true;
// const server = IS_PROD ?
//     "https://kollabvideocallbackend.onrender.com" :

//     "http://localhost:8000"


// export default server;

const isLocalhost = window?.location?.hostname === 'localhost' || window?.location?.hostname === '127.0.0.1';

const server = isLocalhost
  ? "http://localhost:8000"
  : "https://kollabvideocallbackend.onrender.com";

export default server;
