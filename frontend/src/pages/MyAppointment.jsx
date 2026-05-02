import React, { useContext, useEffect, useState } from "react";
import { AppContext } from "../context/AppContext";
import axios from "axios";
import { toast } from "react-toastify";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// ---------------- Payment Form ----------------
const PaymentForm = ({ appointmentId, backendUrl, token, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState(null);
  const [paid, setPaid] = useState(false); // 👈 track local paid state

  const handleCardChange = (event) => {
    setCardComplete(event.complete);
    setCardError(event.error ? event.error.message : null);
  };

  const handlePayment = async () => {
    if (!stripe || !elements) return;
    if (!cardComplete) {
      toast.error("Please complete card details (number, expiry, CVC).");
      return;
    }

    setLoading(true);
    try {
      // 1. Create PaymentIntent
      const { data } = await axios.post(
        backendUrl + "/api/user/payment-stripe",
        { appointmentId },
        { headers: { token } }
      );

      if (!data.success) {
        toast.error(data.message);
        setLoading(false);
        return;
      }

      // 2. Confirm card payment
      const cardElement = elements.getElement(CardElement);
      const result = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: { card: cardElement },
      });

      // 3. Check result
      if (result.error) {
        toast.error(result.error.message);
      } else if (result.paymentIntent?.status === "succeeded") {
        try {
          // 4. Verify on backend & mark appointment paid
          await axios.post(
            backendUrl + "/api/user/verify-stripe-payment",
            {
              paymentIntentId: result.paymentIntent.id,
              appointmentId,
            },
            { headers: { token } }
          );

          toast.success("Payment verified and saved!");
          setPaid(true);       // 👈 switch button to Paid
          onSuccess?.();       // refresh appointments
        } catch (verifyErr) {
          console.error(verifyErr);
          toast.error("Payment succeeded, but verification failed.");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Payment failed, try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2">
      {!paid ? (
        <>
          <CardElement onChange={handleCardChange} />
          {cardError && <p className="text-red-500 text-sm mt-2">{cardError}</p>}
          <button
            onClick={handlePayment}
            disabled={!stripe || loading || !cardComplete}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded"
          >
            {loading ? "Processing..." : "Confirm Payment"}
          </button>
        </>
      ) : (
        <button
          disabled
          className="mt-3 px-4 py-2 bg-green-600 text-white rounded"
        >
          Paid
        </button>
      )}
    </div>
  );
};

// ---------------- MyAppointment ----------------
const MyAppointment = () => {
  const { token, backendUrl, getDoctorsData, currencySymbol } =
    useContext(AppContext);
  const [appointments, setAppointments] = useState([]);
  const months = [
    " ",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const slotDateFormat = (slotDate) => {
    const dateArray = slotDate.split("_");
    return (
      dateArray[0] + " " + months[Number(dateArray[1])] + " " + dateArray[2]
    );
  };

  const getUserAppointments = async () => {
    try {
      const { data } = await axios.get(backendUrl + "/api/user/appointments", {
        headers: { token },
      });
      if (data.success) {
        setAppointments(data.appointments.reverse());
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    }
  };

  const cancelAppointment = async (appointmentId) => {
    try {
      const { data } = await axios.post(
        backendUrl + "/api/user/cancel-appointment",
        { appointmentId },
        { headers: { token } }
      );
      if (data.success) {
        toast.success(data.message);
        getUserAppointments();
        getDoctorsData();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    }
  };

  useEffect(() => {
    if (token) {
      getUserAppointments();
    }
  }, [token]);

  return (
    <div>
      <p className="pb-3 mt-12 font-medium text-zinc-700 border-b">
        My appointments
      </p>
      <div>
        {appointments.map((item, index) => (
          <div
            className="grid grid-cols-[1fr_2fr] gap-4 sm:flex sm:gap-6 py-2 border-b"
            key={index}
          >
            <div>
              <img
                className="w-32 bg-indigo-50"
                src={item.docData.image}
                alt=""
              />
            </div>
            <div className="flex-1 text-sm text-zinc-600">
              <p className="text-neutral-800 font-semibold">
                {item.docData.name}
              </p>
              <p>{item.docData.speciality}</p>
              <p className="text-zinc-700 font-medium mt-1">Address:</p>
              <p className="text-xs">{item.docData.address.line1}</p>
              <p className="text-xs">{item.docData.address.line2}</p>
              <p className="text-xs mt-1">
                <span className="text-sm text-neutral-700 font-medium ">
                  Date & Time:
                </span>
                {slotDateFormat(item.slotDate)} | {item.slotTime}
              </p>
              <p className="text-sm mt-1 font-medium">
                Fee: {currencySymbol}
                {item.amount}{" "}
                {item.paid && (
                  <span className="text-green-600 font-semibold">(Paid)</span>
                )}
              </p>
            </div>
            <div></div>
            <div className="flex flex-col gap-2 justify-end">
              {!item.cancelled ? (
                item.paid ? (
                  // Already paid → show green badge
                  <button className="sm:min-w-48 py-2 border border-green-500 rounded text-green-600 font-medium">
                    Paid
                  </button>
                ) : (
                  <>
                    {/* Payment Form when not paid */}
                    <Elements stripe={stripePromise}>
                      <PaymentForm
                        appointmentId={item._id}
                        backendUrl={backendUrl}
                        token={token}
                        onSuccess={getUserAppointments}
                      />
                    </Elements>

                    {/* Allow cancel only if not paid */}
                    <button
                      onClick={() => cancelAppointment(item._id)}
                      className="text-sm text-stone-500 text-center sm:min-w-48 py-2 border rounded hover:bg-red-600 hover:text-white transition-all duration-300"
                    >
                      Cancel appointment
                    </button>
                  </>
                )
              ) : (
                // Cancelled appointment
                <button className="sm:min-w-48 py-2 border border-red-500 rounded text-red-500">
                  Appointment cancelled
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyAppointment;



// import React, { useContext, useEffect, useState } from "react";
// import { AppContext } from "../context/AppContext";
// import axios from "axios";
// import { toast } from "react-toastify";
// import { loadStripe } from "@stripe/stripe-js";
// import {
//   Elements,
//   CardElement,
//   useStripe,
//   useElements,
// } from "@stripe/react-stripe-js";

// const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// // Payment form component
// const PaymentForm = ({ appointmentId, backendUrl, token, onSuccess }) => {
//   const stripe = useStripe();
//   const elements = useElements();

//   const [loading, setLoading] = useState(false);
//   const [cardComplete, setCardComplete] = useState(false);
//   const [cardError, setCardError] = useState(null);

//   const handleCardChange = (event) => {
//     setCardComplete(event.complete);
//     setCardError(event.error ? event.error.message : null);
//   };

//   const handlePayment = async () => {
//     if (!stripe || !elements) return;

//     if (!cardComplete) {
//       toast.error("Please complete card details (number, expiry, CVC).");
//       return;
//     }

//     setLoading(true);
//     try {
//       // Call backend to create PaymentIntent
//       const { data } = await axios.post(
//         backendUrl + "/api/user/payment-stripe",
//         { appointmentId },
//         { headers: { token } }
//       );

//       if (!data.success) {
//         toast.error(data.message);
//         setLoading(false);
//         return;
//       }

//       const cardElement = elements.getElement(CardElement);
//       const result = await stripe.confirmCardPayment(data.clientSecret, {
//         payment_method: { card: cardElement },
//       });

//       if (result.error) {
//         toast.error(result.error.message);
//       } else if (result.paymentIntent?.status === "succeeded") {
//         toast.success("Payment successful!");
//         onSuccess?.();
//       }
//     } catch (err) {
//       console.error(err);
//       toast.error("Payment failed, try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="mt-2">
//       <CardElement onChange={handleCardChange} />
//       {cardError && <p className="text-red-500 text-sm mt-2">{cardError}</p>}

//       <button
//         onClick={handlePayment}
//         disabled={!stripe || loading || !cardComplete}
//         className="mt-3 px-4 py-2 bg-blue-600 text-white rounded"
//       >
//         {loading ? "Processing..." : "Confirm Payment"}
//       </button>
//     </div>
//   );
// };

// // Main appointments component
// const MyAppointment = () => {
//   const { token, backendUrl, getDoctorsData, currencySymbol } =
//     useContext(AppContext);

//   const [appointments, setAppointments] = useState([]);

//   const months = [
//     " ",
//     "Jan",
//     "Feb",
//     "Mar",
//     "Apr",
//     "May",
//     "Jun",
//     "Jul",
//     "Aug",
//     "Sep",
//     "Oct",
//     "Nov",
//     "Dec",
//   ];

//   const slotDateFormat = (slotDate) => {
//     const dateArray = slotDate.split("_");
//     return (
//       dateArray[0] +
//       " " +
//       months[Number(dateArray[1])] +
//       " " +
//       dateArray[2]
//     );
//   };

//   const getUserAppointments = async () => {
//     try {
//       const { data } = await axios.get(
//         backendUrl + "/api/user/appointments",
//         { headers: { token } }
//       );

//       if (data.success) {
//         setAppointments(data.appointments.reverse());
//       } else {
//         toast.error(data.message);
//       }
//     } catch (error) {
//       console.error(error);
//       toast.error(error.message);
//     }
//   };

//   const cancelAppointment = async (appointmentId) => {
//     try {
//       const { data } = await axios.post(
//         backendUrl + "/api/user/cancel-appointment",
//         { appointmentId },
//         { headers: { token } }
//       );

//       if (data.success) {
//         toast.success(data.message);
//         getUserAppointments();
//         getDoctorsData();
//       } else {
//         toast.error(data.message);
//       }
//     } catch (error) {
//       console.error(error);
//       toast.error(error.message);
//     }
//   };

//   useEffect(() => {
//     if (token) {
//       getUserAppointments();
//     }
//   }, [token]);

//   return (
//     <div>
//       <p className="pb-3 mt-12 font-medium text-zinc-700 border-b">
//         My appointments
//       </p>

//       <div>
//         {appointments.map((item, index) => (
//           <div
//             className="grid grid-cols-[1fr_2fr] gap-4 sm:flex sm:gap-6 py-2 border-b"
//             key={index}
//           >
//             <div>
//               <img
//                 className="w-32 bg-indigo-50"
//                 src={item.docData.image}
//                 alt=""
//               />
//             </div>

//             <div className="flex-1 text-sm text-zinc-600">
//               <p className="text-neutral-800 font-semibold">
//                 {item.docData.name}
//               </p>
//               <p>{item.docData.speciality}</p>

//               <p className="text-zinc-700 font-medium mt-1">Address:</p>
//               <p className="text-xs">{item.docData.address.line1}</p>
//               <p className="text-xs">{item.docData.address.line2}</p>

//               <p className="text-xs mt-1">
//                 <span className="text-sm text-neutral-700 font-medium ">
//                   Date & Time:
//                 </span>{" "}
//                 {slotDateFormat(item.slotDate)} | {item.slotTime}
//               </p>

//               <p className="text-sm mt-1 font-medium">
//                 Fee: {currencySymbol} {item.amount}
//               </p>
//             </div>

//             <div></div>

//             <div className="flex flex-col gap-2 justify-end">
//               {!item.cancelled && (
//                 <Elements stripe={stripePromise}>
//                   <PaymentForm
//                     appointmentId={item._id}
//                     backendUrl={backendUrl}
//                     token={token}
//                     onSuccess={getUserAppointments}
//                   />
//                 </Elements>
//               )}

//               {!item.cancelled && (
//                 <button
//                   onClick={() => cancelAppointment(item._id)}
//                   className="text-sm text-stone-500 text-center sm:min-w-48 py-2 border rounded hover:bg-red-600 hover:text-white transition-all duration-300"
//                 >
//                   Cancel appointment
//                 </button>
//               )}

//               {item.cancelled && (
//                 <button className="sm:min-w-48 py-2 border border-red-500 rounded text-red-500">
//                   Appointment cancelled
//                 </button>
//               )}
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// };

// export default MyAppointment;
