module.exports = (app, db, log) => {
    function getProductIds(data) {
        //log.debug(data);
        const items = data.cart.items ?? [];
        return items.map((item) => item.productId);
    }

    function getProducts(data) {
        const items = data.cart.items ?? [];
        return items.map((item) => {
            return {
                id: item.productId,
                seller: getSeller(item),
            }
        });
    }

    function getSeller(item) {
        const sellers = item.attributes
            .where((attr) => attr.name == 'Seller')
            .map((attr) => attr.value);
        return sellers.length == 0 ? undefined : sellers[0];
    }

    async function getProductPickupPostcode(product) {
        if (!product || !product.seller || product.seller === '') {
            return undefined;
        }
        log.debug('Seller ID: ', product.seller);

        const sellerPostcode = await db.ref('/users').child(sellerId.val()).child('contactDetails/pickupAddress/postcode').get();
        if (sellerPostcode.exists()) {
            log.debug('Found postcode for seller:', sellerPostcode.val());
            return sellerPostcode.val();
        } else {
            log.debug('Could not find the postcode for seller:', sellerId.val());
            return undefined;
        }
    }

//    async function getProductPickupPostcode(product) {
//        if (!productId || productId === '') {
//            return undefined;
//        }
//        log.debug('Product ID: ', productId);
//        const sellerId = await db.ref('/ecwid/products').child(productId).child('seller').get();
//        if (sellerId.exists()) {
//            log.debug('Looking up poscode for seller: ', sellerId.val());
//            const sellerPostcode = await db.ref('/users').child(sellerId.val()).child('shippingAddress/postalcode').get();
//            if (sellerPostcode.exists()) {
//                log.debug('Found postcode for seller:', sellerPostcode.val());
//                return sellerPostcode.val();
//            } else {
//                log.debug('Could not find the postcode for seller:', sellerId.val());
//                return undefined;
//            }
//        } else {
//            log.debug('Could not find the seller for ProductId:', productId);
//            return undefined;
//        }
//    }

    function getShippingPostcode(data) {
        return data?.cart?.shippingAddress?.postalCode;
    }

    function calculateDistance(lat1, lon1, lat2, lon2) {
        // Radius of the Earth in kilometers
        const R = 6371;

        // Convert latitude and longitude from degrees to radians
        const radLat1 = (Math.PI * lat1) / 180;
        const radLon1 = (Math.PI * lon1) / 180;
        const radLat2 = (Math.PI * lat2) / 180;
        const radLon2 = (Math.PI * lon2) / 180;

        // Haversine formula
        const dLat = radLat2 - radLat1;
        const dLon = radLon2 - radLon1;

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(radLat1) * Math.cos(radLat2) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return distance;
    }


    function getDistancesBetweenGL(pickupGL, shippingGL) {
        if (!pickupGL) {
            log.debug('Pickup Geolocation was invalid');
            return undefined;
        }
        if (!shippingGL) {
            log.debug('Shipping Geolocation was invalid');
            return undefined;
        }
        const distance = calculateDistance(
            pickupGL.lat, pickupGL.lng,
            shippingGL.lat, shippingGL.lng);

        log.debug('Distance: ', distance);

        return distance;
    }

    async function getGeolocation(postcode) {
        log.debug('Getting Geolocation for postcode: ', postcode);
        const geolocation = await db.ref('/ecwid/postcodes').child(postcode).get();
        if (geolocation.exists()) {
            log.debug('Geolocation for postcode: ', postcode, geolocation.val());
            return geolocation.val();
        } else {
            log.warn('Could not find geolocation for postcode:', postcode);
            return undefined;
        }
    }

    async function getDeliveryRate(pickupPostcode, shippingPostcode) {
        if (!pickupPostcode) {
            log.warn('Pickup postcode was null');
            return undefined;
        }
        if (!shippingPostcode) {
            log.warn('Shipping postcode was null');
            return undefined;
        }
        const pickupGL = await getGeolocation(pickupPostcode);
        const shippingGL = await getGeolocation(shippingPostcode);
        const distance = getDistancesBetweenGL(pickupGL, shippingGL);
        return Math.floor(distance / 10) * 10;
    }

    async function getProductDeliveryRate(product, shippingPostcode) {
        log.debug('Shipping Postcode:', shippingPostcode, product.id, product.seller);
        const pickupPostcode = await getProductPickupPostcode(product);
        if (pickupPostcode) {
            log.debug('Pickup Postcode:', pickupPostcode);
            return await getDeliveryRate(pickupPostcode, shippingPostcode);
        } else {
            log.warn('The seller pickup postcode could not be found.', product.id);
            return undefined;
        }
    }

    async function getDeliveryRateForProducts(products, shippingPostcode) {
        const deliveryRates =  await Promise.all(products
            .map((product) => getProductDeliveryRate(product, shippingPostcode)));
        if (deliveryRates.includes(undefined)) {
            log.warn('Some delivery rates could not be found for all of the products:',
                productIds, deliveryRates);
            return undefined;
        } else {
            log.debug('Delivery Rates: ', deliveryRates);
            const deliveryRate = deliveryRates.reduce((sum, value) => sum + value, 0);
            log.debug('Delivery Rate: ', deliveryRate);
            return deliveryRate;
        }
    }

    async function getShippingOptions(products, shippingPostcode) {
        const deliveryRate = await getDeliveryRateForProducts(products, shippingPostcode);
        if (deliveryRate) {
            return [
                {
                    "title": "Local delivery",
                    "rate": deliveryRate,
                    "description": "Call will be made to organise delivery date and time.",
                    "fulfilmentType": "DELIVERY",
                    "scheduled": false,
                },
                {
                    "title": "Pickup",
                    "description": "Pickup from product [PICKUP ADDRESS]",
                    "fulfilmentType": "PICKUP",
                    "scheduled": false,
                }
            ];
        } else {
            return [
                {
                    "title": "Pickup",
                    "description": "Pickup from product [PICKUP ADDRESS]",
                    "fulfilmentType": "PICKUP",
                    "scheduled": false,
                }
            ]
        }
    }

    app.post('/shippingOptions', async (req, res) => {
        const data = req.body;

        if (!data) {
            return res.status(400).json({ error: 'Invalid data' });
        }

        const products = getProducts(data);
        const shippingPostcode = getShippingPostcode(data);
        if (shippingPostcode) {
            log.debug('Found shipping postcode', shippingPostcode);
            const shippingOptions = await getShippingOptions(products, shippingPostcode);
            return res.status(200).json({"shippingOptions": shippingOptions});
        } else {
            log.debug('Could not find the shipping postcode');
        }
    });
}