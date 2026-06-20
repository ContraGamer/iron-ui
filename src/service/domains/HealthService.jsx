import { APIs } from '../../const/APIs.jsx';
import HttpService from '../HttpService.jsx';

const HealthService = () => {
  const { getApi } = HttpService();

  const getStatus = () => getApi(APIs.HEALTH.STATUS);

  return { getStatus };
};

export default HealthService;
