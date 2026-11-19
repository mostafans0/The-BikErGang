import { createBrowserRouter } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import RouteError from '@/routes/RouteError'
import Home from '@/routes/Home'
import Shop from '@/routes/Shop'
import FittingRoom from '@/routes/FittingRoom'
import ProductDetail from '@/routes/ProductDetail'
import Cart from '@/routes/Cart'
import Garage from '@/routes/Garage'
import Wishlist from '@/routes/Wishlist'
import Contact from '@/routes/Contact'
import NotFound from '@/routes/NotFound'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Home /> },
      { path: 'shop', element: <Shop /> },
      { path: 'fitting-room', element: <FittingRoom /> },
      { path: 'product/:slug', element: <ProductDetail /> },
      { path: 'cart', element: <Cart /> },
      { path: 'garage', element: <Garage /> },
      { path: 'wishlist', element: <Wishlist /> },
      { path: 'contact', element: <Contact /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
