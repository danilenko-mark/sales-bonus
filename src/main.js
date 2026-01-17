/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */

function calculateSimpleRevenue(purchase, _product) {
    const discountCoefficient = 1 - (purchase.discount / 100);
    const revenue = purchase.sale_price * purchase.quantity * discountCoefficient;
    return revenue;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */

function calculateBonusByProfit(index, total, seller) {
    const { profit } = seller;
    if (index === 0) {
        return profit * 0.15;
    } else if (index === 1 || index === 2) {
        return profit * 0.10;
    } else if (index === total - 1) {
        return 0;
    } else {
        return profit * 0.05;
    }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */

function analyzeSalesData(data, options) {
    // Проверка входных данных
    if (!data
        || !Array.isArray(data.sellers)
        || !Array.isArray(data.products)
        || !Array.isArray(data.purchase_records)
        || !Array.isArray(data.customers)
        || data.sellers.length === 0
        || data.products.length === 0
        || data.purchase_records.length === 0
    ) {
        throw new Error('Некорректные входные данные: данные должны содержать непустые массивы sellers, products, purchase_records и customers');
    }

    // Проверка наличия опций
    if (!options || typeof options !== 'object') {
        throw new Error('Опции должны быть объектом');
    }
    
    const { calculateRevenue, calculateBonus } = options;
    
    if (!calculateRevenue || !calculateBonus) {
        throw new Error('Опции должны содержать функции calculateRevenue и calculateBonus');
    }
    
    if (typeof calculateRevenue !== 'function' || typeof calculateBonus !== 'function') {
        throw new Error('calculateRevenue и calculateBonus должны быть функциями');
    }

    // Подготовка промежуточных данных для сбора статистики
    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {}
    }));

    // Преобразование продавцов и товары в объекты для быстрого доступа
    const sellerIndex = sellerStats.reduce((result, seller) => {
        result[seller.id] = seller;
        return result;
    }, {});
    
    const productIndex = data.products.reduce((result, product) => {
        result[product.sku] = product;
        return result;
    }, {});

    // Шаг 1. Добавить двойной цикл перебора чеков и покупок в них
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        
        if (!seller) {
            // Если продавец не найден, пропускаем запись
            return;
        }
        
        // Увеличить количество продаж
        seller.sales_count += 1;
        
        // Обрабатываем каждый товар в чеке
        record.items.forEach(item => {
            const product = productIndex[item.sku];
            
            // Посчитать себестоимость (cost) товара
            const cost = product ? product.purchase_price * item.quantity : 0;
            
            // Посчитать выручку (revenue) с учётом скидки
            const revenue = calculateRevenue(item, product);
            seller.revenue += revenue;
            
            // Посчитать прибыль: выручка минус себестоимость
            const profit = revenue - cost;
            seller.profit += profit;
            
            // Увеличить счётчик числа проданных товаров
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });
    });

    // Шаг 2. Упорядочить продавцов по прибыли
    sellerStats.sort((a, b) => b.profit - a.profit);

    // Шаг 3. Назначить премии на основе ранжирования
    const totalSellers = sellerStats.length;
    
    sellerStats.forEach((seller, index) => {
        // Посчитать бонус
        seller.bonus = calculateBonus(index, totalSellers, seller);
        
        // Сформировать топ-10 проданных продуктов
        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
    });

    // Шаг 4. Сформировать результат
    return sellerStats.map(seller => ({
        seller_id: seller.id,
        name: seller.name,
        revenue: +seller.revenue.toFixed(2),
        profit: +seller.profit.toFixed(2),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +seller.bonus.toFixed(2)
    }));
}