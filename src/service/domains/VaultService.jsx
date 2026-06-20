import { APIs } from '../../const/APIs.jsx';
import HttpService from '../HttpService.jsx';

const VaultService = () => {
  const { getApi, postApi, putApi, deleteApi } = HttpService();

  const listItems = () =>
    getApi(APIs.VAULT.LIST);

  const createItem = (payload) =>
    postApi(APIs.VAULT.CREATE, payload);

  const getItem = (id) =>
    getApi(APIs.VAULT.GET(id));

  const updateItem = (id, payload) =>
    putApi(APIs.VAULT.UPDATE(id), payload);

  const deleteItem = (id) =>
    deleteApi(APIs.VAULT.DELETE(id));

  const getTrash = () =>
    getApi(APIs.VAULT.TRASH);

  const purgeTrash = () =>
    deleteApi(APIs.VAULT.PURGE_TRASH);

  const restoreItem = (id) =>
    postApi(APIs.VAULT.RESTORE(id));

  const purgeItem = (id) =>
    deleteApi(APIs.VAULT.PURGE(id));

  return {
    listItems,
    createItem,
    getItem,
    updateItem,
    deleteItem,
    getTrash,
    purgeTrash,
    restoreItem,
    purgeItem,
  };
};

export default VaultService;
