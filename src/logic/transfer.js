const log4js = require('log4js');

const config = require('../config');
const apiError = require('../util/api-error');
const redisFactory = require('../util/redis-factory');
const _util = require('../util/util');
const namespace = require('../base/namespace');

const logger = log4js.getLogger('logic_transfer');

const TRANSFER = config.redis_room_transfer_channel;
//创建专门通道
const redis_pub = redisFactory.getInstance();
const _redis = redisFactory.getInstance(true);

const key_reg = new RegExp(config.key_reg);


exports.transfer = transferFn;


//*******************************************************************


async function transferFn(data) {

  data = _util.pick(data, 'namespace targetRoom sourceRooms type');

  //判断命名空间是否存在
  let nspConfig = namespace.data[data.namespace];
  if (!nspConfig) {
    apiError.throw('this namespace lose');
  } else if (nspConfig.offline == 'on') {
    apiError.throw('this namespace offline');
  }

  if (!data.targetRoom
    || !Array.isArray(data.sourceRooms)
    || data.sourceRooms.length <= 0
    || !data.type || !data.namespace) {
    apiError.throw('targetRoom and sourceRooms and type and namespace can not be empty');
  } else if (data.targetRoom.length > 20 || !key_reg.test(data.targetRoom)) {
    apiError.throw('targetRoom invalid');
  } else {
    for (let i = 0; i < data.sourceRooms.length; i++) {
      let room = data.sourceRooms[i];
      if (room.length > 20 || !key_reg.test(room)) {
        apiError.throw('sourceRoom invalid');
      }
    }
  }
  let nspAndRoom = data.namespace + '_' + data.targetRoom;

  let allList = await _redis.sunion(data.sourceRooms.map(function (item) {
    return config.redis_total_room_client_set_prefix + '{' + data.namespace + '_' + item + '}';
  }));
  if (Array.isArray(allList) && allList.length > 0) {
    await _redis[data.type == 'join' ? 'sadd' : 'srem'](config.redis_total_room_client_set_prefix + '{' + nspAndRoom + '}', allList);
  }

  let iosList = await _redis.sunion(data.sourceRooms.map(function (item) {
    return config.redis_total_ios_room_client_set_prefix + '{' + data.namespace + '_' + item + '}';
  }));
  if (Array.isArray(iosList) && iosList.length > 0) {
    await _redis[data.type == 'join' ? 'sadd' : 'srem'](config.redis_total_ios_room_client_set_prefix + '{' + nspAndRoom + '}', iosList);
  }

  let androidList = await _redis.sunion(data.sourceRooms.map(function (item) {
    return config.redis_total_android_room_client_set_prefix + '{' + data.namespace + '_' + item + '}';
  }));
  if (Array.isArray(androidList) && androidList.length > 0) {
    await _redis[data.type == 'join' ? 'sadd' : 'srem'](config.redis_total_android_room_client_set_prefix + '{' + nspAndRoom + '}', androidList);
  }

  redis_pub.publish(TRANSFER, JSON.stringify(data));

}

