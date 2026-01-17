/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */

function calculateSimpleRevenue(purchase, product) {
    const priceWithDiscount = purchase.sale_price * (1 - purchase.discount / 100);
    return priceWithDiscount * purchase.quantity;
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
    
    if (total <= 1) {
        return profit * 0.15;
    }
    
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
    if (!data || typeof data !== 'object') {
        throw new Error('Некорректные входные данные');
    }
    
    const requiredCollections = ['sellers', 'products', 'purchase_records'];
    for (const collection of requiredCollections) {
        if (!Array.isArray(data[collection]) || data[collection].length === 0) {
            throw new Error('Некорректные входные данные');
        }
    }

    // Проверка наличия опций
    if (!options || typeof options !== 'object') {
        throw new Error('Опции должны быть объектом');
    }
    
    const { calculateRevenue, calculateBonus } = options;
    
    if (typeof calculateRevenue !== 'function' || typeof calculateBonus !== 'function') {
        throw new Error('Опции должны содержать функции calculateRevenue и calculateBonus');
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

    // Индексация для быстрого доступа
    const sellerIndex = {};
    sellerStats.forEach(seller => {
        sellerIndex[seller.id] = seller;
    });
    
    const productIndex = {};
    data.products.forEach(product => {
        productIndex[product.sku] = product;
    });

    // Обработка всех записей о продажах
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        
        if (!seller) {
            return;
        }
        
        seller.sales_count += 1;
        // Используем total_amount из чека для выручки
        seller.revenue += record.total_amount;
        
        // Но всё равно обрабатываем товары для расчёта прибыли
        record.items.forEach(item => {
            const product = productIndex[item.sku];
            
            // Рассчитываем себестоимость
            const cost = product ? product.purchase_price * item.quantity : 0;
            
            // Выручку уже посчитали через total_amount, поэтому здесь считаем только выручку от товара для расчёта profit
            const revenue = calculateRevenue(item, product);
            
            // Рассчитываем прибыль от этого товара
            const profit = revenue - cost;
            seller.profit += profit;
            
            // Увеличиваем счетчик проданных товаров
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });
    });

    // Сортировка продавцов по прибыли (по убыванию)
    sellerStats.sort((a, b) => b.profit - a.profit);

    // Расчет бонусов
    const totalSellers = sellerStats.length;
    sellerStats.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, totalSellers, seller);
    });

    // Формирование итогового результата с округлением
    return sellerStats.map(seller => {
        // Формируем топ-10 проданных товаров
        const topProducts = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
        
        // Округляем все денежные значения до 2 знаков после запятой
        // Используем parseFloat(toFixed(2)) для точного округления как в тестах
        return {
            seller_id: seller.id,
            name: seller.name,
            revenue: parseFloat(seller.revenue.toFixed(2)),
            profit: parseFloat(seller.profit.toFixed(2)),
            sales_count: seller.sales_count,
            top_products: topProducts,
            bonus: parseFloat(seller.bonus.toFixed(2))
        };
    });
}