const getCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const domain = isProduction ? 'misadmindev.sundarammutual.com' : 'localhost';

    return {
        httpOnly: isProduction,
        secure: isProduction,
        sameSite: isProduction ? 'Strict' : 'Lax',
        domain,
        path: '/',
        maxAge: 20 * 60 * 1000 // 20 minutes
    };
};

module.exports = {
    getCookieOptions
}; 