module.exports = async (id, AWS) => {
    var ddb = new AWS.DynamoDB();
    var data;
    try{
        const params = {
          TableName: 'products',
          Key: {
            'id': {S: id.toString()}
          }
        };
        const request = ddb.deleteItem(params);
        data = await request.promise();
    } catch(e){
        throw(e);
    }
    return data;
 };