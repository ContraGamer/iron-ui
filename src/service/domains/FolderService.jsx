import { APIs } from '../../const/APIs.jsx';
import HttpService from '../HttpService.jsx';

const FolderService = () => {
  const { getApi, postApi, putApi, deleteApi } = HttpService();

  const listFolders = () =>
    getApi(APIs.FOLDERS.LIST);

  const createFolder = (payload) =>
    postApi(APIs.FOLDERS.CREATE, payload);

  const updateFolder = (id, payload) =>
    putApi(APIs.FOLDERS.UPDATE(id), payload);

  const deleteFolder = (id) =>
    deleteApi(APIs.FOLDERS.DELETE(id));

  return { listFolders, createFolder, updateFolder, deleteFolder };
};

export default FolderService;
