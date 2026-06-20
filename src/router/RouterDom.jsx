import { Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { URLS } from '../const/URLs.jsx';
import { Landing } from '../pages/landing/Landing.jsx';
import { Login } from '../pages/login/Login.jsx';
import { Register } from '../pages/register/Register.jsx';
import { Vault } from '../pages/vault/Vault.jsx';
import { Settings } from '../pages/settings/Settings.jsx';
import { Trash } from '../pages/trash/Trash.jsx';
import useCommonService from '../service/CommonService.jsx';

const PUBLIC_ROUTES = [URLS.LANDING, URLS.LOGIN, URLS.REGISTER];

export function RouterDom() {
  const location = useLocation();
  const { isAuthenticated, setShowSidebar } = useCommonService();
  const [isAuth, setIsAuth] = useState(isAuthenticated());

  useEffect(() => {
    const auth = isAuthenticated();
    setIsAuth(auth);
    setShowSidebar(auth && !PUBLIC_ROUTES.includes(location.pathname));
  }, [location]);

  return (
    <Routes>
      <Route path={URLS.LANDING}  element={<Landing />} />
      <Route path={URLS.LOGIN}    element={<Login />} />
      <Route path={URLS.REGISTER} element={<Register />} />

      {isAuth ? (
        <>
          <Route path={URLS.VAULT}    element={<Vault />} />
          <Route path={URLS.SETTINGS} element={<Settings />} />
          <Route path={URLS.TRASH}    element={<Trash />} />
        </>
      ) : (
        <Route path="*" element={<Login />} />
      )}
    </Routes>
  );
}
