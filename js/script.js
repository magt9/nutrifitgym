// js/script.js - POS Gimnasio con Pestaña de Control de Acceso por Clave

function initGymApp() {
  return {
    user: null,
    cargandoAuth: true,
    modoRegistro: false,
    emailAuth: '',
    passAuth: '',

    pestanaActiva: 'pos', // 'pos' o 'acceso'
    claveAccesoInput: '',
    resultadoAcceso: null,

    darkMode: true,
    procesandoCobro: false,
    busquedaSocio: '',
    mostrarSociosModal: false,
    mostrarAdmin: false,
    mostrarInventario: false,
    mostrarReporte: false,

    gymStoreId: localStorage.getItem('gym_store_id') || 'gym_default_store',

    pinAdmin: '1234',
    socioActivo: { id: 'general', nombre: 'Cliente General / Pase por Día', vencido: false, fechaVencimiento: 'N/A', clave: 'GEN00' },
    socios: [],
    menu: [],
    cartActual: [],
    ventasRealizadas: [],

    nuevoSocioNombre: '',
    nuevoSocioTelefono: '',
    nuevoSocioClave: '',
    nuevoNombre: '',
    nuevoPrecio: '',
    nuevoEmoji: '🏋️‍♂️',
    nuevoEsServicio: true,
    nuevaDuracionDias: '30',

    initDatabase() {
      const localMenu = localStorage.getItem('gym_menu_cache');
      if (localMenu) this.menu = JSON.parse(localMenu);

      const localSocios = localStorage.getItem('gym_socios_cache');
      if (localSocios) this.socios = JSON.parse(localSocios);

      setTimeout(() => { this.cargandoAuth = false; }, 1000);

      try {
        if (typeof firebase !== 'undefined' && !firebase.apps.length) {
          firebase.initializeApp({
            apiKey: "AIzaSyCmT6nhn604z13KYwBtgORwKbil_aUx20s",
            authDomain: "mi-pos-restaurant-appsweb.firebaseapp.com",
            projectId: "mi-pos-restaurant-appsweb",
            storageBucket: "mi-pos-restaurant-appsweb.firebasestorage.app",
            messagingSenderId: "329389609164",
            appId: "1:329389609164:web:24839bef9222d58c79b269"
          });
        }

        if (typeof firebase !== 'undefined' && firebase.auth) {
          firebase.auth().onAuthStateChanged((user) => {
            if (user) {
              this.user = user;
              this.gymStoreId = user.uid;
              localStorage.setItem('gym_store_id', user.uid);
              this.cargarDatosGym();
            } else {
              this.user = null;
            }
            this.cargandoAuth = false;
          });
        }
      } catch (e) {
        console.error("Aviso Firebase:", e);
        this.cargandoAuth = false;
      }

      if (localStorage.getItem('gym_darkMode') !== null) {
        this.darkMode = localStorage.getItem('gym_darkMode') === 'true';
      }
    },

    toggleDarkMode() {
      this.darkMode = !this.darkMode;
      localStorage.setItem('gym_darkMode', this.darkMode);
    },

    procesarAuth() {
      this.cargandoAuth = true;
      if (this.modoRegistro) {
        firebase.auth().createUserWithEmailAndPassword(this.emailAuth, this.passAuth)
          .then((cred) => {
            this.user = cred.user;
            this.gymStoreId = cred.user.uid;
            localStorage.setItem('gym_store_id', cred.user.uid);
            this.cargarDatosGym();
          })
          .catch(err => {
            if (err.code === 'auth/email-already-in-use') {
              alert("Este correo ya está registrado. Cambiando a Iniciar Sesión...");
              this.modoRegistro = false;
            } else {
              alert("Error al registrar: " + err.message);
            }
          })
          .finally(() => this.cargandoAuth = false);
      } else {
        firebase.auth().signInWithEmailAndPassword(this.emailAuth, this.passAuth)
          .then((cred) => {
            this.user = cred.user;
            this.gymStoreId = cred.user.uid;
            localStorage.setItem('gym_store_id', cred.user.uid);
            this.cargarDatosGym();
          })
          .catch(err => alert("Error al iniciar sesión: " + err.message))
          .finally(() => this.cargandoAuth = false);
      }
    },

    cerrarSesion() {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().signOut().then(() => { this.user = null; });
      } else {
        this.user = null;
      }
    },

    cargarDatosGym() {
      if (typeof firebase === 'undefined' || !firebase.firestore) return;
      const db = firebase.firestore();

      db.collection('gyms').doc(this.gymStoreId).collection('productos')
        .onSnapshot((snapshot) => {
          if (!snapshot.empty) {
            this.menu = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            localStorage.setItem('gym_menu_cache', JSON.stringify(this.menu));
          }
        });

      db.collection('gyms').doc(this.gymStoreId).collection('socios')
        .onSnapshot((snapshot) => {
          if (!snapshot.empty) {
            this.socios = snapshot.docs.map(doc => {
              const data = doc.data();
              const hoy = new Date().toISOString().split('T')[0];
              const vencido = data.fechaVencimiento ? data.fechaVencimiento < hoy : true;
              return { id: doc.id, ...data, vencido };
            });
            localStorage.setItem('gym_socios_cache', JSON.stringify(this.socios));
          }
        });
    },

    // --- LÓGICA DEL CONTROL DE ACCESO DE MIEMBROS ---
    verificarAccesoSocio(claveBuscada) {
      if (!claveBuscada) return;

      const term = claveBuscada.trim().toLowerCase();
      const socio = this.socios.find(s => 
        (s.clave && s.clave.toLowerCase() === term) || 
        (s.nombre && s.nombre.toLowerCase() === term)
      );

      if (socio) {
        const hoy = new Date().toISOString().split('T')[0];
        const estaVencido = socio.fechaVencimiento ? socio.fechaVencimiento < hoy : true;

        this.resultadoAcceso = {
          ...socio,
          vencido: estaVencido
        };
      } else {
        alert("⚠️ No se encontró ningún socio con la clave: " + claveBuscada);
        this.resultadoAcceso = null;
      }

      this.claveAccesoInput = '';
    },

    cargarSocioACaja(socio) {
      this.socioActivo = socio;
      this.pestanaActiva = 'pos';
      this.resultadoAcceso = null;
    },

    agregarProductoWeb() {
      if (!this.nuevoNombre || !this.nuevoPrecio) {
        return alert("Por favor ingresa un nombre y un precio.");
      }

      const nuevoItem = {
        id: 'item_' + Date.now(),
        nombre: this.nuevoNombre,
        precio: Number(this.nuevoPrecio),
        imagen: this.nuevoEmoji || '🏋️‍♂️',
        esServicio: !!this.nuevoEsServicio,
        duracionDias: this.nuevoEsServicio ? Number(this.nuevaDuracionDias) : 0,
        stock: this.nuevoEsServicio ? 0 : 10
      };

      this.menu.push(nuevoItem);
      localStorage.setItem('gym_menu_cache', JSON.stringify(this.menu));

      if (typeof firebase !== 'undefined' && firebase.firestore) {
        firebase.firestore().collection('gyms').doc(this.gymStoreId).collection('productos').doc(nuevoItem.id).set(nuevoItem);
      }

      this.nuevoNombre = '';
      this.nuevoPrecio = '';
      this.nuevoEmoji = '🏋️‍♂️';
      this.nuevoEsServicio = true;
      this.nuevaDuracionDias = '30';

      alert("¡Ítem guardado correctamente!");
    },

    eliminarProductoWeb(id) {
      if (confirm("¿Deseas borrar este producto del catálogo?")) {
        this.menu = this.menu.filter(i => i.id !== id);
        localStorage.setItem('gym_menu_cache', JSON.stringify(this.menu));

        if (typeof firebase !== 'undefined' && firebase.firestore) {
          firebase.firestore().collection('gyms').doc(this.gymStoreId).collection('productos').doc(id).delete();
        }
      }
    },

    get listaSociosFiltrada() {
      if (!this.busquedaSocio) return this.socios;
      const term = this.busquedaSocio.toLowerCase();
      return this.socios.filter(s => 
        (s.nombre && s.nombre.toLowerCase().includes(term)) ||
        (s.clave && s.clave.toLowerCase().includes(term))
      );
    },

    seleccionarSocio(socio) {
      this.socioActivo = socio;
      this.mostrarSociosModal = false;
    },

    seleccionarSocioGeneral() {
      this.socioActivo = { id: 'general', nombre: 'Cliente General / Pase por Día', vencido: false, fechaVencimiento: 'N/A', clave: 'GEN00' };
    },

    registrarNuevoSocio() {
      if (!this.nuevoSocioNombre) return alert("Ingresa el nombre del socio.");

      const claveUnica = this.nuevoSocioClave || 'GYM' + Math.floor(1000 + Math.random() * 9000);

      const nuevoSocioObj = {
        id: 'socio_' + Date.now(),
        nombre: this.nuevoSocioNombre,
        telefono: this.nuevoSocioTelefono || '',
        clave: claveUnica,
        fechaVencimiento: '',
        vencido: true
      };

      this.socios.push(nuevoSocioObj);
      localStorage.setItem('gym_socios_cache', JSON.stringify(this.socios));

      if (typeof firebase !== 'undefined' && firebase.firestore) {
        firebase.firestore().collection('gyms').doc(this.gymStoreId).collection('socios').doc(nuevoSocioObj.id).set(nuevoSocioObj);
      }

      this.nuevoSocioNombre = '';
      this.nuevoSocioTelefono = '';
      this.nuevoSocioClave = '';
      alert(`Socio guardado con la clave: ${claveUnica}`);
    },

    addToCart(product) {
      if (!product.esServicio && product.stock <= 0) {
        return alert("¡Producto agotado!");
      }
      this.cartActual.push({ ...product });
    },

    removeFromCart(index) {
      this.cartActual.splice(index, 1);
    },

    getTotalActual() {
      return this.cartActual.reduce((sum, item) => sum + Number(item.precio), 0);
    },

    priceFormat(amount) {
      return '$' + Number(amount || 0).toFixed(2);
    },

    cobrarCuentaSocio() {
      if (this.cartActual.length === 0) return;

      const itemsServicios = this.cartActual.filter(item => item.esServicio);
      const contieneServicio = itemsServicios.length > 0;

      if (contieneServicio && this.socioActivo.id === 'general') {
        const claveBuscada = prompt("Vas a cobrar una Membresía. Ingresa la CLAVE ÚNICA del socio (o deja vacío para crear uno nuevo):");

        if (claveBuscada) {
          let socioEncontrado = this.socios.find(s => s.clave === claveBuscada || s.nombre.toLowerCase() === claveBuscada.toLowerCase());
          if (socioEncontrado) {
            this.socioActivo = socioEncontrado;
          } else {
            const nomNew = prompt("Clave no encontrada. Ingresa el NOMBRE completo para registrar a este nuevo socio:");
            if (!nomNew) return;
            
            const newSocio = {
              id: 'socio_' + Date.now(),
              nombre: nomNew,
              clave: claveBuscada,
              fechaVencimiento: '',
              vencido: true
            };
            this.socios.push(newSocio);
            this.socioActivo = newSocio;
          }
        }
      }

      this.procesandoCobro = true;
      const total = this.getTotalActual();

      if (contieneServicio && this.socioActivo.id !== 'general') {
        const hoy = new Date();
        let fechaBase = new Date();

        if (this.socioActivo.fechaVencimiento && new Date(this.socioActivo.fechaVencimiento) > hoy) {
          fechaBase = new Date(this.socioActivo.fechaVencimiento);
        }

        let diasASumar = 0;
        itemsServicios.forEach(s => {
          diasASumar += Number(s.duracionDias || 30);
        });

        fechaBase.setDate(fechaBase.getDate() + diasASumar);
        const nuevaFecha = fechaBase.toISOString().split('T')[0];

        this.socioActivo.fechaVencimiento = nuevaFecha;
        this.socioActivo.vencido = false;

        const indexS = this.socios.findIndex(s => s.id === this.socioActivo.id);
        if (indexS !== -1) {
          this.socios[indexS] = { ...this.socioActivo };
          localStorage.setItem('gym_socios_cache', JSON.stringify(this.socios));
        }

        if (typeof firebase !== 'undefined' && firebase.firestore) {
          firebase.firestore().collection('gyms').doc(this.gymStoreId).collection('socios').doc(this.socioActivo.id).set(this.socioActivo, { merge: true });
        }
      }

      const ventaObj = {
        id: 'venta_' + Date.now(),
        socioNombre: this.socioActivo.nombre,
        socioClave: this.socioActivo.clave || 'N/A',
        total: total,
        fechaTexto: new Date().toLocaleTimeString()
      };

      this.ventasRealizadas.unshift(ventaObj);
      this.cartActual = [];
      this.procesandoCobro = false;

      alert("¡Cobro realizado con éxito!");
    },

    imprimirTicketSocio() {
      window.print();
    },

    solicitarPinAdmin(modal) {
      const pin = prompt("Ingresa el PIN de administración:");
      if (pin === this.pinAdmin) {
        if (modal === 'admin') this.mostrarAdmin = true;
        if (modal === 'inventario') this.mostrarInventario = true;
        if (modal === 'reporte') this.mostrarReporte = true;
      } else if (pin !== null) {
        alert("PIN Incorrecto.");
      }
    },

    cambiarPinAdmin() {
      const nuevoPin = prompt("Nuevo PIN de 4 dígitos:");
      if (nuevoPin) {
        this.pinAdmin = nuevoPin;
        alert("PIN modificado.");
      }
    },

    actualizarStockProducto(prod) {
      const nuevoStock = prompt(`Ajustar inventario para ${prod.nombre}:`, prod.stock || 0);
      if (nuevoStock !== null) {
        prod.stock = Number(nuevoStock);
        localStorage.setItem('gym_menu_cache', JSON.stringify(this.menu));
      }
    },

    getTotalVentas() {
      return this.ventasRealizadas.reduce((sum, v) => sum + Number(v.total || 0), 0);
    }
  };
}
