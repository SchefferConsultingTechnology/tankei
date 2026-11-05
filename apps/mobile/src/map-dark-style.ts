/**
 * Estilo escuro do Google Maps nos tons da marca (ADR 0017). No Android, o
 * `userInterfaceStyle` do react-native-maps não escureceu o mapa; o estilo
 * JSON resolve. Formato: https://developers.google.com/maps/documentation/javascript/style-reference
 * (sem importar react-native-maps aqui: só o StationMap conhece o provedor, ADR 0010).
 */
export const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0F1E3D' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9AABC6' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#07122A' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#24395F' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#0C1A36' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#132548' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#7F91AD' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#10263A' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#24395F' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#162A50' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#33507F' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#C7D2E3' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#162A50' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#050D1F' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4E6286' }],
  },
];
