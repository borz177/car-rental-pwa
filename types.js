"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transmission = exports.FuelType = exports.RequestStatus = exports.FineStatus = exports.TransactionType = exports.CarStatus = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["SUPERADMIN"] = "SUPERADMIN";
    UserRole["ADMIN"] = "ADMIN";
    UserRole["STAFF"] = "STAFF";
    UserRole["CLIENT"] = "CLIENT";
})(UserRole || (exports.UserRole = UserRole = {}));
var CarStatus;
(function (CarStatus) {
    CarStatus["AVAILABLE"] = "\u0421\u0432\u043E\u0431\u043E\u0434\u0435\u043D";
    CarStatus["RENTED"] = "\u0412 \u0430\u0440\u0435\u043D\u0434\u0435";
    CarStatus["MAINTENANCE"] = "\u0412 \u0440\u0435\u043C\u043E\u043D\u0442\u0435";
    CarStatus["RESERVED"] = "\u0417\u0430\u0431\u0440\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D";
})(CarStatus || (exports.CarStatus = CarStatus = {}));
var TransactionType;
(function (TransactionType) {
    TransactionType["INCOME"] = "\u0414\u043E\u0445\u043E\u0434";
    TransactionType["EXPENSE"] = "\u0420\u0430\u0441\u0445\u043E\u0434";
    TransactionType["PAYOUT"] = "\u0412\u044B\u043F\u043B\u0430\u0442\u0430";
})(TransactionType || (exports.TransactionType = TransactionType = {}));
var FineStatus;
(function (FineStatus) {
    FineStatus["PAID"] = "\u041E\u043F\u043B\u0430\u0447\u0435\u043D";
    FineStatus["UNPAID"] = "\u041D\u0435 \u043E\u043F\u043B\u0430\u0447\u0435\u043D";
})(FineStatus || (exports.FineStatus = FineStatus = {}));
var RequestStatus;
(function (RequestStatus) {
    RequestStatus["PENDING"] = "\u041E\u0436\u0438\u0434\u0430\u0435\u0442";
    RequestStatus["APPROVED"] = "\u041E\u0434\u043E\u0431\u0440\u0435\u043D\u043E";
    RequestStatus["REJECTED"] = "\u041E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u043E";
})(RequestStatus || (exports.RequestStatus = RequestStatus = {}));
var FuelType;
(function (FuelType) {
    FuelType["PETROL"] = "\u0411\u0435\u043D\u0437\u0438\u043D";
    FuelType["DIESEL"] = "\u0414\u0438\u0437\u0435\u043B\u044C";
    FuelType["ELECTRIC"] = "\u042D\u043B\u0435\u043A\u0442\u0440\u043E";
    FuelType["HYBRID"] = "\u0413\u0438\u0431\u0440\u0438\u0434";
})(FuelType || (exports.FuelType = FuelType = {}));
var Transmission;
(function (Transmission) {
    Transmission["AUTO"] = "\u0410\u041A\u041F\u041F";
    Transmission["MANUAL"] = "\u041C\u041A\u041F\u041F";
})(Transmission || (exports.Transmission = Transmission = {}));
//# sourceMappingURL=types.js.map