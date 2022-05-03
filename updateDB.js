module.exports = async (id, data, AWS) => {
    var ddb = new AWS.DynamoDB();
    var response;
    try{
        const params = {
            TableName: 'products',
            Item: {
                'id' : {S: id},
                'data' : {S: data}
            }
        };
        const request = ddb.putItem(params);
        response = await request.promise();
    } catch(e){
        throw(e);
    }
    return response;
 };
