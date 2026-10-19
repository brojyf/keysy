import { createRoot } from 'react-dom/client';
import DesignStudio from './DesignStudio.jsx';
import './studio.css';
import './logo/preview.css';
import './theme/preview.css';

createRoot(document.getElementById('root')).render(<DesignStudio />);
