import './App.css';
import 'boxicons';
import { RouterDom } from './router/RouterDom.jsx';
import { Sidebar } from './components/Sidebar/Sidebar.jsx';
import { useSidebar } from './context/SidebarProvider.jsx';

function App() {
  const { showSidebar, sidebarExpanded } = useSidebar();

  return (
    <div className="dom-root">
      {showSidebar && <Sidebar />}
      <div className={[
        'content-page',
        showSidebar ? 'with-sidebar' : '',
        showSidebar && sidebarExpanded ? 'sidebar-expanded' : '',
      ].filter(Boolean).join(' ')}>
        <RouterDom />
      </div>
    </div>
  );
}

export default App;
