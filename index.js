///////////////////////////////////
//  Copy Right Khaled Abouseada  //
///////////////////////////////////
const AWS = require("aws-sdk"),
https = require('https'),
updateDB = require("./updateDB"),
deleteItem = require("./deleteItem");
AWS.config.update({region: 'us-east-1'});
let buf = Buffer.from(process.env.TOKEN);
process.env.TOKEN = buf.toString('base64');

// Function to update a product
async function updateProduct(id){
    let data = JSON.parse(await getProduct(id));
    if (data.code === 200 && data.result.sync_variants){
        let arr = [];
        let other_images = {};
        let colors_map = {};
        let variants_data = [];
        let main_image;
        for (let i = 0 ; i < data.result.sync_variants.length ; i++){
            let variant_data = JSON.parse(await getVariant(data.result.sync_variants[i].variant_id));
            if (variant_data.code === 200 && variant_data.result.variant){
                data.result.sync_variants[i].original_vaiant = variant_data.result;
            } else {
                await sleep(1200);
                variant_data = JSON.parse(await getVariant(data.result.sync_variants[i].variant_id)); 
                if (variant_data.code === 200 && variant_data.result.variant){
                    data.result.sync_variants[i].original_vaiant = variant_data.result;
                } else {
                    return "err_del";
                }
            }
        }
        for (let i = 0 ; i < data.result.sync_variants.length; i++){
            let editedColor;
            let editedSize;
            if (data.result.sync_variants[i].original_vaiant.variant.color === null){
                editedColor = "Clear";
            } else {
                editedColor = data.result.sync_variants[i].original_vaiant.variant.color;
            }
            if (data.result.sync_variants[i].original_vaiant.variant.size === null){
                editedSize = "One Size";
            } else {
                editedSize = data.result.sync_variants[i].original_vaiant.variant.size;
            }
            variants_data.push({sku:data.result.sync_variants[i].id, price:data.result.sync_variants[i].retail_price, size: editedSize, color:editedColor});
            if (other_images[`${editedColor}`] === undefined){
                other_images[`${editedColor}`] = [];
            }
            if (colors_map[`${editedColor}`] === undefined){
                colors_map[`${editedColor}`] = [];
            }
            colors_map[`${editedColor}`][colors_map[`${editedColor}`].length] = editedSize;
            for (let j = 0 ; j < data.result.sync_variants[i].files.length ; j++){
                if (data.result.sync_variants[i].files[j].type === "preview" && data.result.sync_variants[i].files[j].status === "ok"){
                    if (!other_images[`${editedColor}`].includes(`${data.result.sync_variants[i].files[j].preview_url}`) || editedColor === "Clear"){
                        other_images[`${editedColor}`].push(data.result.sync_variants[i].files[j].preview_url);
                    }
                    if (i == 0){
                        main_image = data.result.sync_variants[i].files[j].preview_url;
                    }
                } else if (data.result.sync_variants[i].files[j].type === "preview" && data.result.sync_variants[i].files[j].status !== "ok"){
                    updateProduct(id);
                }
            }
            arr[arr.length] = data.result.sync_variants[i].retail_price;
        }
        let new_product = {};
        new_product.source = "printful";
        new_product.id = data.result.sync_product.id.toString();
        new_product.product_name = data.result.sync_product.name;
        new_product.product_description = data.result.sync_variants[0].original_vaiant.product.description;
        new_product.count = data.result.sync_product.variants;
        new_product.images = {main:`${main_image}`,other:other_images};
        new_product.colors_map = colors_map;
        new_product.min_price = Math.min(...arr);
        new_product.max_price = Math.max(...arr);
        new_product.variants = variants_data;
        await updateDB(id, JSON.stringify(new_product), AWS);
        await post("https://68b8-2600-1017-b415-39b0-10ea-5c03-93ba-c3b.ngrok.io/trigger_update", {type: "product_updated" ,id: id});
        return "success";
    } else {
        await deleteItem(id.toString(), AWS);
        await post("https://68b8-2600-1017-b415-39b0-10ea-5c03-93ba-c3b.ngrok.io/trigger_update", {type: "product_deleted" ,id: id});
        return "err_del";
    }
}

// Function to trigger update data API in the application.
async function post(url, data) {
    var dataStr = JSON.stringify(data);
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': dataStr.length,
            'auth': `${process.env.AUTH}`
        },
    };
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            const body = [];
            res.on('data', (chunk) => body.push(chunk));
            res.on('end', () => {
                const resString = Buffer.concat(body).toString();
                resolve(resString);
            });
        });
        req.on('error', (err) => {
            reject(err);
        });
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request time out'));
        });
        req.write(dataStr);
        req.end();
    });
}

// Function to get variants from printful.
async function getVariant(id){
    const options = {
        method: 'GET',
        headers: {
            Authorization: `Basic ${process.env.TOKEN}`
        },
    };
    return new Promise((resolve, reject) => {
        const req = https.request(`https://api.printful.com/products/variant/${id}`, options, (res) => {
            const body = [];
            res.on('data', (chunk) => body.push(chunk));
            res.on('end', () => {
                const resString = Buffer.concat(body);
                resolve(resString);
            });
        });
        req.on('error', (err) => {
            reject(err);
        });
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request time out'));
        });
        req.end();
    });
}

// Function to get a product from printful.
async function getProduct(id){
    const options = {
        method: 'GET',
        headers: {
            Authorization: `Basic ${process.env.TOKEN}`
        },
    };
    return new Promise((resolve, reject) => {
        const req = https.request(`https://api.printful.com/store/products/${id}`, options, (res) => {
            const body = [];
            res.on('data', (chunk) => body.push(chunk));
            res.on('end', () => {
                const resString = Buffer.concat(body);
                resolve(resString);
            });
        });
        req.on('error', (err) => {
            reject(err);
        });
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request time out'));
        });
        req.end();
    });
}

// Function to get the intial products of existing store
async function getProducts(offSet){
    const options = {
        method: 'GET',
        headers: {
            Authorization: `Basic ${process.env.TOKEN}`
        },
    };
    return new Promise((resolve, reject) => {
        const req = https.request(`https://api.printful.com/store/products?limit=10&offset=${offSet}`, options, (res) => {
            const body = [];
            res.on('data', (chunk) => body.push(chunk));
            res.on('end', () => {
                const resString = Buffer.concat(body);
                resolve(resString);
            });
        });
        req.on('error', (err) => {
            reject(err);
        });
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request time out'));
        });
        req.end();
    });
}

// Main handler function
exports.handler = async function(event, context) {
    if (event.requestContext.http.method === "POST" && event.requestContext.http.path === "/printful_webhook_API" && event.requestContext.http.userAgent === "Printful API Webhook Daemon"){
        const data = JSON.parse(event.body);
        if(data.type && data.type === "product_deleted"){
            await deleteItem(data.data.sync_product.id.toString(), AWS);
            await post("https://68b8-2600-1017-b415-39b0-10ea-5c03-93ba-c3b.ngrok.io/trigger_update", {type: data.type ,id: data.data.sync_product.id.toString()});
        } else if(data.type && data.type === "product_updated"){
            await sleep(2000);
            if (data.data && data.data.sync_product){
                let updates = await updateProduct(data.data.sync_product.id.toString());
                if (updates === "err_del"){
                    await sleep(1200);
                    await updateProduct(data.data.sync_product.id.toString());
                }
            } else {
                let updates = await updateProduct(data.data.id.toString());
                if (updates === "err_del"){
                    await sleep(1200);
                    await updateProduct(data.data.sync_product.id.toString());
                }
            }
        }
        return;
    } else if(event.requestContext.http === "/intial"){
        // .path
        let count = 0;
        let results = [];
        let data = JSON.parse(await getProducts(0));
        if (data.code === 200){
            for (let i = 0 ; i < data.result.length ; i++){
                results[results.length] = JSON.stringify(data.result[i]);
                await updateProduct(data.result[i].id.toString());
                count ++;
            }
            let more = Math.ceil(data.paging.total/10);
            for (let i = 1 ; i < more ; i++){
                let data2 = JSON.parse(await getProducts(i*10));
                if (data2.code === 200){
                    for (let j = 0 ; j < data2.result.length ; j++){
                        results[results.length] = JSON.stringify(data2.result[j]);
                        await updateProduct(data2.result[j].id.toString());
                        count ++;
                    }    
                } else {
                    return "Failed";
                }
            }
            return `done! Total: ${count}` + "\n\n" +  results.toString();
        } else {
            return "Failed";
        }
    } else {
        context.fail();
    }
};

// Function to sleep for a period and wait
function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
}