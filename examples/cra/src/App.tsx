import './App.css'
import { SignOrderPage } from './components/signOrder'
import { SignOrderCancellationPage } from './components/signOrderCancellation'
import { GetTradesPage } from './components/getTrades'
import { GetOrdersPage } from './components/getOrders'
import { GetQuotePage } from './components/getQuote'
import { SignAndSendOrderPage } from './components/sendOrder'
import { SendOrderCancellationPage } from './components/sendOrderCancellation'

const ACTIONS = [
  { title: 'Get quote', Component: GetQuotePage },
  { title: 'Get trades', Component: GetTradesPage },
  { title: 'Get orders', Component: GetOrdersPage },
  { title: 'Sign order', Component: SignOrderPage },
  { title: 'Sign and send order', Component: SignAndSendOrderPage },
  { title: 'Sign order cancellation', Component: SignOrderCancellationPage },
  { title: 'Send order cancellation', Component: SendOrderCancellationPage },
]

function App() {
  return (
    <div className="App">
      {ACTIONS.map(({ title, Component }) => {
        return (
          <div key={title} className="section">
            <div>{title}</div>
            <div>
              <Component />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default App
