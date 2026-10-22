// const catchAsync = require("../../../shared/catchAsync");
// const sendResponse = require("../../../shared/sendResponse");
// const pick = require("../../../shared/pick");
// const OrderService = require("./order.service");
// const OrderFraudCheckService = require("./orderFraudCheck.service");
// const TrackingService = require("../tracking/tracking.service");
// const { getClientIp } = require("../../utils/clientIp");

// // Retain the same ID on retries and in the browser for platform deduplication.
// async function deliverPurchase(payload, context) {
//   for (let attempt = 0; attempt < 3; attempt += 1) {
//     try {
//       const result = await TrackingService.trackEvent(payload, context);
//       if (result.results.every((item) => item.ok || item.skipped)) return;
//     } catch {
//       // Tracking failures must never turn a saved order into a failed checkout.
//     }
//     if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
//   }
//   console.warn("Purchase tracking delivery failed", payload.eventId);
// }

// const createOrder = catchAsync(async (req, res) => {
//   const result = await OrderService.createOrderInDB({
//     ...req.body,
//     ipAddress: getClientIp(req),
//   });
//   if (req.body.landingTracking?.enabled === true) {
//     const eventId = `Purchase.order.${result.Id || result.orderId}`;
//     result.purchaseEventId = eventId;
//     result.purchaseValue = Number(result.totalBill);
//     result.purchaseCurrency = "BDT";
//     void deliverPurchase({
//       eventName: "Purchase",
//       eventId,
//       eventSourceUrl: req.body.landingTracking.eventSourceUrl,
//       userData: {
//         ...(req.body.tracking || {}),
//         name: result.customerName,
//         phone: result.customerPhone,
//         customerId: result.customerId,
//       },
//       customData: {
//         ...(req.body.landingTracking.customData || {}),
//         value: Number(result.totalBill),
//         currency: "BDT",
//         order_id: result.orderId || result.Id,
//       },
//     }, { headers: req.headers, ip: getClientIp(req) });
//   }
//   sendResponse(res, {
//     statusCode: 201,
//     success: true,
//     message: "Order created successfully",
//     data: result,
//   });
// });

// const createStaffOrder = catchAsync(async (req, res) => {
//   const result = await OrderService.createStaffOrderInDB(req.body);
//   sendResponse(res, {
//     statusCode: 201,
//     success: true,
//     message: "Order created successfully",
//     data: result,
//   });
// });

// const saveIncompleteOrder = catchAsync(async (req, res) => {
//   const result = await OrderService.saveIncompleteOrderInDB({
//     ...req.body,
//     ipAddress: getClientIp(req),
//   });
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Incomplete order saved successfully",
//     data: result,
//   });
// });

// const getOrders = catchAsync(async (req, res) => {
//   const filters = pick(req.query, ["status", "search", "fromDate", "toDate", "assignedEmployeeId"]);
//   const paginationOptions = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);
//   const result = await OrderService.getOrdersFromDB(filters, paginationOptions, req.user);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Orders fetched successfully",
//     meta: result.meta,
//     data: result.data,
//   });
// });

// const getOrderStatusCounts = catchAsync(async (req, res) => {
//   const result = await OrderService.getOrderStatusCountsFromDB(req.user);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Order status counts fetched successfully",
//     data: result,
//   });
// });

// const getOrderById = catchAsync(async (req, res) => {
//   const result = await OrderService.getOrderByIdFromDB(req.params.id, req.user);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Order fetched successfully",
//     data: result,
//   });
// });

// const getOrderFraudCheck = catchAsync(async (req, res) => {
//   const result = await OrderFraudCheckService.getFraudCheckFromDB(req.params.id, {
//     refresh: req.query.refresh === "1" || req.query.refresh === "true",
//   });
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Order fraud check fetched successfully",
//     data: result,
//   });
// });

// const getAssignableEmployees = catchAsync(async (req, res) => {
//   const result = await OrderService.getAssignableEmployeesFromDB();
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Assignable employees fetched successfully",
//     data: result,
//   });
// });

// const bulkAssignOrdersToEmployee = catchAsync(async (req, res) => {
//   const result = await OrderService.bulkAssignOrdersToEmployeeInDB(
//     req.body.orderIds || [],
//     req.body.employeeId,
//     req.user,
//   );
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Orders assigned successfully",
//     data: result,
//   });
// });

// const trackOrdersByPhone = catchAsync(async (req, res) => {
//   const result = await OrderService.trackOrdersByPhoneFromDB(req.query.phone, req.query.invoiceId, {
//     includeHistory: req.query.history === "true",
//   });
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Orders tracked successfully",
//     data: result,
//   });
// });

// const sendReconfirmOtp = catchAsync(async (req, res) => {
//   const result = await OrderService.sendOrderReconfirmOtpInDB(req.params.id, req.body);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: result.alreadyConfirmed
//       ? "Order is already confirmed"
//       : "OTP sent successfully",
//     data: result,
//   });
// });

// const verifyReconfirmOtp = catchAsync(async (req, res) => {
//   const result = await OrderService.verifyOrderReconfirmOtpInDB(req.params.id, req.body);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Order confirmed successfully",
//     data: result,
//   });
// });

// const updateOrder = catchAsync(async (req, res) => {
//   const result = await OrderService.updateOrderInDB(req.params.id, req.body);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Order updated successfully",
//     data: result,
//   });
// });

// const updateOrderStatus = catchAsync(async (req, res) => {
//   const result = await OrderService.updateOrderStatusInDB(req.params.id, req.body.status, req.user.Id);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Order status updated successfully",
//     data: result,
//   });
// });

// const sendOrderToSteadfast = catchAsync(async (req, res) => {
//   const result = await OrderService.sendOrderToSteadfastInDB(req.params.id, req.body);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Order sent to Steadfast successfully",
//     data: result,
//   });
// });

// const sendOrderToPathao = catchAsync(async (req, res) => {
//   const result = await OrderService.sendOrderToPathaoInDB(req.params.id, req.body);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Order sent to Pathao successfully",
//     data: result,
//   });
// });

// const bulkSendOrdersToSteadfast = catchAsync(async (req, res) => {
//   const result = await OrderService.bulkSendOrdersToSteadfastInDB(req.body.orderIds || [], req.body);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Orders sent to Steadfast successfully",
//     data: result,
//   });
// });

// const bulkSendOrdersToPathao = catchAsync(async (req, res) => {
//   const result = await OrderService.bulkSendOrdersToPathaoInDB(req.body.orderIds || [], req.body);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Orders sent to Pathao successfully",
//     data: result,
//   });
// });

// const syncSteadfastStatus = catchAsync(async (req, res) => {
//   const result = await OrderService.syncSteadfastStatusInDB(req.params.id);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Steadfast status synced successfully",
//     data: result,
//   });
// });

// const syncPathaoStatus = catchAsync(async (req, res) => {
//   const result = await OrderService.syncPathaoStatusInDB(req.params.id);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Pathao status synced successfully",
//     data: result,
//   });
// });

// const getSteadfastBalance = catchAsync(async (req, res) => {
//   const result = await OrderService.getSteadfastBalanceFromProvider();
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Steadfast balance fetched successfully",
//     data: result,
//   });
// });

// const createSteadfastReturnRequest = catchAsync(async (req, res) => {
//   const result = await OrderService.createSteadfastReturnRequestInDB(req.params.id, req.body.reason);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Steadfast return request created successfully",
//     data: result,
//   });
// });

// const getSteadfastReturnRequests = catchAsync(async (req, res) => {
//   const result = await OrderService.getSteadfastReturnRequestsFromProvider();
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Steadfast return requests fetched successfully",
//     data: result,
//   });
// });

// const getSteadfastPayments = catchAsync(async (req, res) => {
//   const result = await OrderService.getSteadfastPaymentsFromProvider(req.params.paymentId);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Steadfast payments fetched successfully",
//     data: result,
//   });
// });

// const getSteadfastPoliceStations = catchAsync(async (req, res) => {
//   const result = await OrderService.getSteadfastPoliceStationsFromProvider();
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Steadfast police stations fetched successfully",
//     data: result,
//   });
// });

// const deleteOrder = catchAsync(async (req, res) => {
//   const result = await OrderService.deleteOrderFromDB(req.params.id);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: result.message,
//     data: null,
//   });
// });

// const OrderController = {
//   createOrder,
//   createStaffOrder,
//   saveIncompleteOrder,
//   getOrders,
//   getOrderStatusCounts,
//   getOrderById,
//   getOrderFraudCheck,
//   getAssignableEmployees,
//   bulkAssignOrdersToEmployee,
//   trackOrdersByPhone,
//   sendReconfirmOtp,
//   verifyReconfirmOtp,
//   updateOrder,
//   updateOrderStatus,
//   sendOrderToSteadfast,
//   sendOrderToPathao,
//   bulkSendOrdersToSteadfast,
//   bulkSendOrdersToPathao,
//   syncSteadfastStatus,
//   syncPathaoStatus,
//   getSteadfastBalance,
//   createSteadfastReturnRequest,
//   getSteadfastReturnRequests,
//   getSteadfastPayments,
//   getSteadfastPoliceStations,
//   deleteOrder,
// };

// module.exports = OrderController;

const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");

const OrderService = require("./order.service");
const OrderFraudCheckService = require("./orderFraudCheck.service");
const TrackingService = require("../tracking/tracking.service");

const { getClientIp } = require("../../utils/clientIp");

// ==========================================
// META PURCHASE TRACKING RETRY HANDLER
// ==========================================

// Use the same Event ID across browser,
// server and retry attempts.
//
// Empty or skipped-only results do not count
// as successful delivery.

async function deliverPurchase(payload, context) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await TrackingService.trackEvent(payload, context);

      const results = Array.isArray(response?.results) ? response.results : [];

      const attempted = results.filter((item) => !item.skipped);

      const delivered =
        attempted.length > 0 && attempted.every((item) => item.ok === true);

      if (delivered) {
        return;
      }
    } catch (error) {
      // Tracking must not cancel a saved order.
      console.warn(
        "Purchase tracking attempt failed",
        payload.eventId,
        error?.message,
      );
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  console.warn("Purchase tracking delivery failed", payload.eventId);
}

// ==========================================
// CREATE ORDER + META CAPI PURCHASE
// ==========================================

const createOrder = catchAsync(async (req, res) => {
  const result = await OrderService.createOrderInDB({
    ...req.body,
    ipAddress: getClientIp(req),
  });

  const landingTracking = req.body?.landingTracking;

  // Always use the saved order amount.
  // Never trust the client-provided price.

  const purchaseValue = Number(result.totalBill);

  const isValidPurchaseValue =
    Number.isFinite(purchaseValue) && purchaseValue > 0;

  if (landingTracking?.enabled === true && isValidPurchaseValue) {
    const orderKey = result.Id || result.orderId;

    if (orderKey) {
      const eventId = `Purchase.order.${orderKey}`;

      // Return matching values to frontend
      // for browser/server deduplication.

      result.purchaseEventId = eventId;
      result.purchaseValue = purchaseValue;
      result.purchaseCurrency = "BDT";

      void deliverPurchase(
        {
          eventName: "Purchase",

          eventId,

          eventSourceUrl: landingTracking.eventSourceUrl,

          userData: {
            ...(req.body.tracking || {}),

            name: result.customerName,
            phone: result.customerPhone,
            customerId: result.customerId,
          },

          customData: {
            ...(landingTracking.customData || {}),

            // Override any client-provided values
            // using the actual saved order.

            value: purchaseValue,
            currency: "BDT",
            order_id: result.orderId || result.Id,
          },
        },

        {
          headers: req.headers,
          ip: getClientIp(req),
        },
      );
    } else {
      console.warn("Purchase tracking skipped: saved order has no ID");
    }
  } else if (landingTracking?.enabled === true) {
    console.warn(
      "Purchase tracking skipped: invalid saved order total",
      result.Id,
    );
  }

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Order created successfully",
    data: result,
  });
});

// ==========================================
// CREATE STAFF ORDER
// ==========================================

const createStaffOrder = catchAsync(async (req, res) => {
  const result = await OrderService.createStaffOrderInDB(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Order created successfully",
    data: result,
  });
});

// ==========================================
// SAVE INCOMPLETE ORDER
// ==========================================

const saveIncompleteOrder = catchAsync(async (req, res) => {
  const result = await OrderService.saveIncompleteOrderInDB({
    ...req.body,
    ipAddress: getClientIp(req),
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Incomplete order saved successfully",
    data: result,
  });
});

// ==========================================
// GET ALL ORDERS
// ==========================================

const getOrders = catchAsync(async (req, res) => {
  const filters = pick(req.query, [
    "status",
    "search",
    "fromDate",
    "toDate",
    "assignedEmployeeId",
  ]);

  const paginationOptions = pick(req.query, [
    "page",
    "limit",
    "sortBy",
    "sortOrder",
  ]);

  const result = await OrderService.getOrdersFromDB(
    filters,
    paginationOptions,
    req.user,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Orders fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

// ==========================================
// ORDER STATUS COUNTS
// ==========================================

const getOrderStatusCounts = catchAsync(async (req, res) => {
  const result = await OrderService.getOrderStatusCountsFromDB(req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order status counts fetched successfully",
    data: result,
  });
});

// ==========================================
// GET ORDER BY ID
// ==========================================

const getOrderById = catchAsync(async (req, res) => {
  const result = await OrderService.getOrderByIdFromDB(req.params.id, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order fetched successfully",
    data: result,
  });
});

// ==========================================
// FRAUD CHECK
// ==========================================

const getOrderFraudCheck = catchAsync(async (req, res) => {
  const result = await OrderFraudCheckService.getFraudCheckFromDB(
    req.params.id,
    {
      refresh: req.query.refresh === "1" || req.query.refresh === "true",
    },
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order fraud check fetched successfully",
    data: result,
  });
});

// ==========================================
// ASSIGNABLE EMPLOYEES
// ==========================================

const getAssignableEmployees = catchAsync(async (req, res) => {
  const result = await OrderService.getAssignableEmployeesFromDB();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Assignable employees fetched successfully",
    data: result,
  });
});

// ==========================================
// BULK ASSIGN ORDERS
// ==========================================

const bulkAssignOrdersToEmployee = catchAsync(async (req, res) => {
  const result = await OrderService.bulkAssignOrdersToEmployeeInDB(
    req.body.orderIds || [],
    req.body.employeeId,
    req.user,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Orders assigned successfully",
    data: result,
  });
});

// ==========================================
// TRACK ORDERS BY PHONE
// ==========================================

const trackOrdersByPhone = catchAsync(async (req, res) => {
  const result = await OrderService.trackOrdersByPhoneFromDB(
    req.query.phone,
    req.query.invoiceId,
    {
      includeHistory: req.query.history === "true",
    },
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Orders tracked successfully",
    data: result,
  });
});

// ==========================================
// SEND RECONFIRM OTP
// ==========================================

const sendReconfirmOtp = catchAsync(async (req, res) => {
  const result = await OrderService.sendOrderReconfirmOtpInDB(
    req.params.id,
    req.body,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.alreadyConfirmed
      ? "Order is already confirmed"
      : "OTP sent successfully",
    data: result,
  });
});

// ==========================================
// VERIFY RECONFIRM OTP
// ==========================================

const verifyReconfirmOtp = catchAsync(async (req, res) => {
  const result = await OrderService.verifyOrderReconfirmOtpInDB(
    req.params.id,
    req.body,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order confirmed successfully",
    data: result,
  });
});

// ==========================================
// UPDATE ORDER
// ==========================================

const updateOrder = catchAsync(async (req, res) => {
  const result = await OrderService.updateOrderInDB(req.params.id, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order updated successfully",
    data: result,
  });
});

// ==========================================
// UPDATE ORDER STATUS
// ==========================================

const updateOrderStatus = catchAsync(async (req, res) => {
  const result = await OrderService.updateOrderStatusInDB(
    req.params.id,
    req.body.status,
    req.user.Id,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order status updated successfully",
    data: result,
  });
});

// ==========================================
// SEND ORDER TO STEADFAST
// ==========================================

const sendOrderToSteadfast = catchAsync(async (req, res) => {
  const result = await OrderService.sendOrderToSteadfastInDB(
    req.params.id,
    req.body,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order sent to Steadfast successfully",
    data: result,
  });
});

// ==========================================
// SEND ORDER TO PATHAO
// ==========================================

const sendOrderToPathao = catchAsync(async (req, res) => {
  const result = await OrderService.sendOrderToPathaoInDB(
    req.params.id,
    req.body,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order sent to Pathao successfully",
    data: result,
  });
});

// ==========================================
// BULK SEND TO STEADFAST
// ==========================================

const bulkSendOrdersToSteadfast = catchAsync(async (req, res) => {
  const result = await OrderService.bulkSendOrdersToSteadfastInDB(
    req.body.orderIds || [],
    req.body,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Orders sent to Steadfast successfully",
    data: result,
  });
});

// ==========================================
// BULK SEND TO PATHAO
// ==========================================

const bulkSendOrdersToPathao = catchAsync(async (req, res) => {
  const result = await OrderService.bulkSendOrdersToPathaoInDB(
    req.body.orderIds || [],
    req.body,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Orders sent to Pathao successfully",
    data: result,
  });
});

// ==========================================
// SYNC STEADFAST STATUS
// ==========================================

const syncSteadfastStatus = catchAsync(async (req, res) => {
  const result = await OrderService.syncSteadfastStatusInDB(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Steadfast status synced successfully",
    data: result,
  });
});

// ==========================================
// SYNC PATHAO STATUS
// ==========================================

const syncPathaoStatus = catchAsync(async (req, res) => {
  const result = await OrderService.syncPathaoStatusInDB(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Pathao status synced successfully",
    data: result,
  });
});

// ==========================================
// STEADFAST BALANCE
// ==========================================

const getSteadfastBalance = catchAsync(async (req, res) => {
  const result = await OrderService.getSteadfastBalanceFromProvider();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Steadfast balance fetched successfully",
    data: result,
  });
});

// ==========================================
// CREATE STEADFAST RETURN REQUEST
// ==========================================

const createSteadfastReturnRequest = catchAsync(async (req, res) => {
  const result = await OrderService.createSteadfastReturnRequestInDB(
    req.params.id,
    req.body.reason,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Steadfast return request created successfully",
    data: result,
  });
});

// ==========================================
// GET STEADFAST RETURN REQUESTS
// ==========================================

const getSteadfastReturnRequests = catchAsync(async (req, res) => {
  const result = await OrderService.getSteadfastReturnRequestsFromProvider();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Steadfast return requests fetched successfully",
    data: result,
  });
});

// ==========================================
// GET STEADFAST PAYMENTS
// ==========================================

const getSteadfastPayments = catchAsync(async (req, res) => {
  const result = await OrderService.getSteadfastPaymentsFromProvider(
    req.params.paymentId,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Steadfast payments fetched successfully",
    data: result,
  });
});

// ==========================================
// GET STEADFAST POLICE STATIONS
// ==========================================

const getSteadfastPoliceStations = catchAsync(async (req, res) => {
  const result = await OrderService.getSteadfastPoliceStationsFromProvider();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Steadfast police stations fetched successfully",
    data: result,
  });
});

// ==========================================
// DELETE ORDER
// ==========================================

const deleteOrder = catchAsync(async (req, res) => {
  const result = await OrderService.deleteOrderFromDB(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: null,
  });
});

// ==========================================
// EXPORT ALL CONTROLLERS
// ==========================================

const OrderController = {
  createOrder,
  createStaffOrder,
  saveIncompleteOrder,
  getOrders,
  getOrderStatusCounts,
  getOrderById,
  getOrderFraudCheck,
  getAssignableEmployees,
  bulkAssignOrdersToEmployee,
  trackOrdersByPhone,
  sendReconfirmOtp,
  verifyReconfirmOtp,
  updateOrder,
  updateOrderStatus,
  sendOrderToSteadfast,
  sendOrderToPathao,
  bulkSendOrdersToSteadfast,
  bulkSendOrdersToPathao,
  syncSteadfastStatus,
  syncPathaoStatus,
  getSteadfastBalance,
  createSteadfastReturnRequest,
  getSteadfastReturnRequests,
  getSteadfastPayments,
  getSteadfastPoliceStations,
  deleteOrder,
};

module.exports = OrderController;
