/**
 * Конвертация плоского строения дерева во вложенный через 'children'
 * @param {Array} items - массив элементов c полями связей
 * с родительскими элементами
 * @param {String} id - ID элемента
 * @param {String} idLink - имя свойства ID
 * @param {String} link - имя связанного поля
 * @example [{id:1, parentId: null }, {id:2, parentId: 1 }] -> [{id:1, children: [id:2] }]
 */
export const flatToNested = (
  items: any[],
  id = null,
  idLink = 'id',
  link = 'parentId'
): any[] => {
  return items
    .filter(item => item[link] === id)
    .map(item => ({
      ...item,
      children: flatToNested(items, item[idLink])
    }))
}

export const formatSecond = (second: number)=> {
  if (second === 0) {
    return ''
  }
  const days = Math.floor(second / 86400);
  const hours = Math.floor((second % 86400) / 3600);
  const minutes = Math.floor(((second % 86400) % 3600) / 60);
  const seconds = Math.floor(((second % 86400) % 3600) % 60);

  console.log(days,hours, minutes, seconds);

  const hourStr = PrefixZero(hours, 2);
  const minuteStr = PrefixZero(minutes, 2);
  const secondStr = PrefixZero(seconds, 2);

  if (days) {
    return `${days}d:${hourStr}:${minuteStr}:${secondStr}`
  }
  if (hours) {
    return `${hourStr}:${minuteStr}:${secondStr}`
  }
  if (minutes) {
    return `${minuteStr}:${secondStr}`
  }
  return `0:${secondStr}`;
}


function PrefixZero(num:number, n:number) {
  return (Array(n).join('0') + num).slice(-n);
}

