import './dashboard.css';
import './baker.css';
import {mountBakerView} from './view/bakerView';
const app=document.getElementById('app');
if(app)mountBakerView(app);
